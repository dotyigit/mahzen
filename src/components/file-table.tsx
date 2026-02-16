'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'motion/react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Trash2,
  Eye,
  ClipboardCopy,
  FileText,
  ExternalLink,
  Info,
  Tag,
  Share2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type S3Object, formatBytes, formatDate } from '@/lib/s3-types'
import { FileIcon } from '@/components/file-icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

type SortField = 'name' | 'size' | 'lastModified' | 'storageClass'
type SortDirection = 'asc' | 'desc'

interface FileTableProps {
  objects: S3Object[]
  onNavigate: (path: string) => void
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  viewMode: 'list' | 'grid'
  onShowDetails: (obj: S3Object) => void
  onClearDetails: () => void
  bucketName: string
  onDelete: (keys: string[]) => void
  onDownload: (obj: S3Object) => void
  onPresign?: (obj: S3Object) => void
  doubleClickNav?: boolean
  showFileIcons?: boolean
  dateFormat?: 'relative' | 'absolute' | 'iso'
  sizeFormat?: 'binary' | 'decimal'
  fontSize?: number
  compactMode?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  isSearchMode?: boolean
}

export function FileTable({
  objects,
  onNavigate,
  selectedKeys,
  onSelectionChange,
  viewMode,
  onShowDetails,
  onClearDetails,
  bucketName,
  onDelete,
  onDownload,
  onPresign,
  doubleClickNav = true,
  showFileIcons = true,
  dateFormat = 'relative',
  sizeFormat = 'binary',
  fontSize = 12,
  compactMode = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isSearchMode = false,
}: FileTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const parentRef = useRef<HTMLDivElement>(null)

  const sortedObjects = useMemo(() => {
    const sorted = [...objects].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'lastModified':
          comparison = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
          break
        case 'storageClass':
          comparison = (a.storageClass || '').localeCompare(b.storageClass || '')
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [objects, sortField, sortDirection])

  const rowHeight = isSearchMode ? (compactMode ? 38 : 48) : (compactMode ? 28 : 36)

  const rowVirtualizer = useVirtualizer({
    count: sortedObjects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
  })

  // Load more when scrolling near the bottom
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore || viewMode !== 'list') return
    const items = rowVirtualizer.getVirtualItems()
    if (items.length === 0) return
    const lastItem = items[items.length - 1]
    if (lastItem && lastItem.index >= sortedObjects.length - 30) {
      onLoadMore()
    }
  }, [rowVirtualizer.getVirtualItems(), hasMore, isLoadingMore, onLoadMore, sortedObjects.length, viewMode])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleRowClick = useCallback(
    (obj: S3Object, event: React.MouseEvent) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        const newKeys = new Set(selectedKeys)
        if (newKeys.has(obj.key)) {
          newKeys.delete(obj.key)
        } else {
          newKeys.add(obj.key)
        }
        onSelectionChange(newKeys)
      } else {
        // Single click navigates folders when doubleClickNav is off
        if (!doubleClickNav && obj.type === 'folder') {
          onNavigate(obj.key)
          onSelectionChange(new Set())
        } else {
          onSelectionChange(new Set([obj.key]))
        }
      }
    },
    [selectedKeys, onSelectionChange, doubleClickNav, onNavigate],
  )

  const handleDoubleClick = useCallback(
    (obj: S3Object) => {
      if (obj.type === 'folder') {
        onNavigate(obj.key)
        onSelectionChange(new Set())
      } else {
        onShowDetails(obj)
      }
    },
    [onNavigate, onSelectionChange, onShowDetails],
  )

  const handleSelectAll = useCallback(() => {
    if (selectedKeys.size === objects.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(objects.map((o) => o.key)))
    }
  }, [objects, selectedKeys, onSelectionChange])

  const handleBackgroundClick = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return
      const target = e.target as HTMLElement
      if (target.closest('[data-file-row]') || target.closest('[data-table-header]')) return
      onSelectionChange(new Set())
      onClearDetails()
    },
    [onSelectionChange, onClearDetails],
  )

  const sortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    )
  }

  // Grid virtualization: track container width and compute columns
  const gridParentRef = useRef<HTMLDivElement>(null)
  const [gridColumns, setGridColumns] = useState(5)
  const cardMinWidth = 140
  const gridGap = compactMode ? 4 : 8
  const gridPadding = compactMode ? 8 : 12
  const gridRowHeight = compactMode ? 72 : 100

  useEffect(() => {
    const el = gridParentRef.current
    if (!el || viewMode !== 'grid') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth
      const available = width - gridPadding * 2
      const cols = Math.max(1, Math.floor((available + gridGap) / (cardMinWidth + gridGap)))
      setGridColumns(cols)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [viewMode, gridGap, gridPadding, cardMinWidth])

  const gridRowCount = Math.ceil(sortedObjects.length / gridColumns)

  const gridVirtualizer = useVirtualizer({
    count: gridRowCount,
    getScrollElement: () => gridParentRef.current,
    estimateSize: () => gridRowHeight + gridGap,
    overscan: 5,
  })

  // Load more for grid view
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore || viewMode !== 'grid') return
    const items = gridVirtualizer.getVirtualItems()
    if (items.length === 0) return
    const lastItem = items[items.length - 1]
    if (lastItem && lastItem.index >= gridRowCount - 3) {
      onLoadMore()
    }
  }, [gridVirtualizer.getVirtualItems(), hasMore, isLoadingMore, onLoadMore, gridRowCount, viewMode])

  if (objects.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
        onPointerDown={handleBackgroundClick}
      >
        <FileText className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">This folder is empty</p>
          <p className="mt-1 text-xs">Upload files or create a new folder to get started</p>
        </div>
      </motion.div>
    )
  }

  if (viewMode === 'grid') {
    const virtualGridRows = gridVirtualizer.getVirtualItems()
    return (
      <div
        ref={gridParentRef}
        className={cn('flex-1 overflow-y-auto overflow-x-hidden', compactMode ? 'p-2' : 'p-3')}
        onPointerDown={handleBackgroundClick}
      >
        <div
          className="relative"
          style={{ height: `${gridVirtualizer.getTotalSize()}px` }}
        >
          {virtualGridRows.map((virtualRow) => {
            const startIndex = virtualRow.index * gridColumns
            const rowItems = sortedObjects.slice(startIndex, startIndex + gridColumns)
            return (
              <div
                key={virtualRow.index}
                className="absolute left-0 top-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="grid h-full"
                  style={{
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                    gap: `${gridGap}px`,
                  }}
                >
                  {rowItems.map((obj) => (
                    <FileContextMenu key={obj.key} obj={obj} bucketName={bucketName} onNavigate={onNavigate} onShowDetails={onShowDetails} onDelete={onDelete} onDownload={onDownload} onPresign={onPresign}>
                      <div
                        data-file-row
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleRowClick(obj, e)}
                        onDoubleClick={() => handleDoubleClick(obj)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDoubleClick(obj)
                        }}
                        className={cn(
                          'group flex h-full min-w-0 cursor-default flex-col items-center overflow-hidden rounded-lg border text-center transition-all duration-150',
                          compactMode ? 'gap-1 p-1.5' : 'gap-2 p-3',
                          selectedKeys.has(obj.key)
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-transparent hover:border-border hover:bg-secondary/50',
                        )}
                      >
                        {showFileIcons && <FileIcon name={obj.name} type={obj.type} className={cn('shrink-0', compactMode ? 'h-6 w-6' : 'h-8 w-8')} />}
                        <div className="w-full min-w-0">
                          <p className="truncate font-medium text-foreground" style={{ fontSize }}>{obj.name}</p>
                          {isSearchMode && obj.key !== obj.name && (
                            <p className="truncate text-muted-foreground" style={{ fontSize: Math.max(fontSize - 2, 9) }}>{obj.key}</p>
                          )}
                          {obj.type === 'file' && !isSearchMode && (
                            <p className="mt-0.5 text-muted-foreground" style={{ fontSize: fontSize - 2 }}>{formatBytes(obj.size, sizeFormat)}</p>
                          )}
                        </div>
                      </div>
                    </FileContextMenu>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {hasMore && (
          <div className="flex items-center justify-center py-4">
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <button type="button" onClick={onLoadMore} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Load more...
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const virtualItems = rowVirtualizer.getVirtualItems()

  return (
    <div className="flex flex-1 flex-col overflow-hidden" onPointerDown={handleBackgroundClick}>
      <div className="w-full min-w-[700px]">
        {/* Header */}
        <div data-table-header className={cn('flex items-center border-b border-border bg-card', compactMode ? '[&>div]:py-1' : '[&>div]:py-2')}>
          <div className="flex w-11 flex-shrink-0 items-center justify-center">
            <Checkbox
              checked={objects.length > 0 && selectedKeys.size === objects.length}
              onCheckedChange={handleSelectAll}
              className="h-3.5 w-3.5"
              aria-label="Select all"
            />
          </div>
          <div className="flex-1 pr-4">
            <button
              type="button"
              onClick={() => handleSort('name')}
              className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Name {sortIcon("name")}
            </button>
          </div>
          <div className="w-24 flex-shrink-0 pr-4">
            <button
              type="button"
              onClick={() => handleSort('size')}
              className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Size {sortIcon("size")}
            </button>
          </div>
          <div className="w-28 flex-shrink-0 pr-4">
            <button
              type="button"
              onClick={() => handleSort('lastModified')}
              className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Modified {sortIcon("lastModified")}
            </button>
          </div>
          <div className="w-28 flex-shrink-0 pr-4">
            <button
              type="button"
              onClick={() => handleSort('storageClass')}
              className="group flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Class {sortIcon("storageClass")}
            </button>
          </div>
          <div className="w-24 flex-shrink-0 pr-4">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              ETag
            </span>
          </div>
        </div>
      </div>

      {/* Virtualized Rows */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
      >
        <div
          className="relative w-full min-w-[700px]"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const obj = sortedObjects[virtualRow.index]
            const isSelected = selectedKeys.has(obj.key)
            return (
              <FileContextMenu key={obj.key} obj={obj} bucketName={bucketName} onNavigate={onNavigate} onShowDetails={onShowDetails} onDelete={onDelete} onDownload={onDownload} onPresign={onPresign}>
                <div
                  data-file-row
                  role="row"
                  tabIndex={0}
                  onClick={(e) => handleRowClick(obj, e)}
                  onDoubleClick={() => handleDoubleClick(obj)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDoubleClick(obj)
                  }}
                  className={cn(
                    'group absolute left-0 top-0 flex w-full cursor-default items-center border-b border-border/30 transition-colors duration-100',
                    isSelected ? 'bg-primary/5' : 'hover:bg-secondary/50',
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="flex w-11 flex-shrink-0 items-center justify-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const newKeys = new Set(selectedKeys)
                        if (checked) {
                          newKeys.add(obj.key)
                        } else {
                          newKeys.delete(obj.key)
                        }
                        onSelectionChange(newKeys)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5"
                      aria-label={`Select ${obj.name}`}
                    />
                  </div>
                  <div className="flex flex-1 items-center gap-2.5 overflow-hidden pr-4">
                    {showFileIcons && <FileIcon name={obj.name} type={obj.type} />}
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate font-medium',
                          obj.type === 'folder' ? 'text-foreground' : 'text-foreground/90',
                        )}
                        style={{ fontSize }}
                      >
                        {obj.name}
                      </span>
                      {isSearchMode && obj.key !== obj.name && (
                        <span className="block truncate text-muted-foreground" style={{ fontSize: Math.max(fontSize - 2, 9) }}>
                          {obj.key}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-24 flex-shrink-0 pr-4">
                    <span className="font-mono text-muted-foreground" style={{ fontSize }}>
                      {obj.type === 'folder' ? '--' : formatBytes(obj.size, sizeFormat)}
                    </span>
                  </div>
                  <div className="w-28 flex-shrink-0 pr-4">
                    <span className="text-muted-foreground" style={{ fontSize }}>{formatDate(obj.lastModified, dateFormat)}</span>
                  </div>
                  <div className="w-28 flex-shrink-0 pr-4">
                    {obj.storageClass && (
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 font-medium',
                          obj.storageClass === 'STANDARD'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : obj.storageClass === 'GLACIER'
                              ? 'bg-cyan-500/10 text-cyan-400'
                              : 'bg-amber-500/10 text-amber-400',
                        )}
                        style={{ fontSize: fontSize - 2 }}
                      >
                        {obj.storageClass}
                      </span>
                    )}
                  </div>
                  <div className="w-24 flex-shrink-0 pr-4">
                    {obj.etag && (
                      <span className="font-mono text-muted-foreground/60" style={{ fontSize: fontSize - 2 }}>
                        {obj.etag.replace(/"/g, '').slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              </FileContextMenu>
            )
          })}
        </div>
        {hasMore && (
          <div className="flex items-center justify-center py-3">
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-xs text-muted-foreground">Scroll to load more...</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`, {
    description: text.length > 60 ? `${text.slice(0, 60)}...` : text,
  })
}

function FileContextMenu({
  children,
  obj,
  bucketName,
  onNavigate,
  onShowDetails,
  onDelete,
  onDownload,
  onPresign,
}: {
  children: React.ReactNode
  obj: S3Object
  bucketName: string
  onNavigate: (path: string) => void
  onShowDetails: (obj: S3Object) => void
  onDelete: (keys: string[]) => void
  onDownload: (obj: S3Object) => void
  onPresign?: (obj: S3Object) => void
}) {
  const s3Uri = `s3://${bucketName}/${obj.key}`
  const objectUrl = `https://${bucketName}.s3.amazonaws.com/${obj.key}`
  const arn = `arn:aws:s3:::${bucketName}/${obj.key}`

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {obj.type === 'folder' ? (
          <ContextMenuItem className="gap-2 text-xs" onSelect={() => onNavigate(obj.key)}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open Folder
          </ContextMenuItem>
        ) : (
          <ContextMenuItem className="gap-2 text-xs" onSelect={() => onShowDetails(obj)}>
            <Eye className="h-3.5 w-3.5" />
            Preview
          </ContextMenuItem>
        )}
        {obj.type === 'file' && (
          <ContextMenuItem className="gap-2 text-xs" onSelect={() => onDownload(obj)}>
            <Download className="h-3.5 w-3.5" />
            Download
            <ContextMenuShortcut>{'Ctrl+D'}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {obj.type === 'file' && onPresign && (
          <ContextMenuItem className="gap-2 text-xs" onSelect={() => onPresign(obj)}>
            <Share2 className="h-3.5 w-3.5" />
            Get Presigned URL
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2 text-xs">
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy to Clipboard
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyToClipboard(s3Uri, 'S3 URI')}>
              <FileText className="h-3.5 w-3.5" />
              Copy S3 URI
            </ContextMenuItem>
            <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyToClipboard(objectUrl, 'Object URL')}>
              <ExternalLink className="h-3.5 w-3.5" />
              Copy Object URL
            </ContextMenuItem>
            <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyToClipboard(arn, 'ARN')}>
              <FileText className="h-3.5 w-3.5" />
              Copy ARN
            </ContextMenuItem>
            {obj.etag && (
              <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyToClipboard(obj.etag!, 'ETag')}>
                <Tag className="h-3.5 w-3.5" />
                Copy ETag
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2 text-xs" onSelect={() => onShowDetails(obj)}>
          <Info className="h-3.5 w-3.5" />
          Properties
          <ContextMenuShortcut>{'Ctrl+I'}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2 text-xs text-destructive focus:text-destructive" onSelect={() => onDelete([obj.key])}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
