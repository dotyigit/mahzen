'use client'

import { useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCw,
  Search,
  LayoutGrid,
  LayoutList,
  Upload,
  FolderPlus,
  Download,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface BrowserToolbarProps {
  bucketName: string
  currentPath: string
  onNavigate: (path: string) => void
  onGoBack: () => void
  onGoForward: () => void
  onGoUp: () => void
  canGoBack: boolean
  canGoForward: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: 'list' | 'grid'
  onViewModeChange: (mode: 'list' | 'grid') => void
  selectedCount: number
  onRefresh: () => void
  isRefreshing: boolean
  onUpload: () => void
  onNewFolder: () => void
  onDeleteSelected: () => void
  onDownloadSelected: () => void
}

export function BrowserToolbar({
  bucketName,
  currentPath,
  onNavigate,
  onGoBack,
  onGoForward,
  onGoUp,
  canGoBack,
  canGoForward,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  selectedCount,
  onRefresh,
  isRefreshing,
  onUpload,
  onNewFolder,
  onDeleteSelected,
  onDownloadSelected,
}: BrowserToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const pathParts = currentPath.split('/').filter(Boolean)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col border-b border-border bg-card">
      {/* Navigation Row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <TooltipProvider delayDuration={300}>
          {/* Navigation Buttons */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Back</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  aria-label="Go forward"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Forward</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onGoUp}
                  disabled={currentPath === ''}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  aria-label="Go up one level"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
            </Tooltip>
          </div>

          {/* Breadcrumb / Path bar */}
          <div className="mx-2 flex flex-1 items-center rounded-md border border-border bg-background/50 px-3 py-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80"
                    onClick={() => onNavigate('')}
                  >
                    {bucketName}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathParts.map((part, index) => {
                  const path = `${pathParts.slice(0, index + 1).join('/')}/`
                  const isLast = index === pathParts.length - 1
                  return (
                    <span key={path} className="flex items-center">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="text-xs">{part}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            className="cursor-pointer text-xs hover:text-foreground"
                            onClick={() => onNavigate(path)}
                          >
                            {part}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search files... (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-52 rounded-md border border-border bg-background/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:w-64 transition-all duration-200"
            />
          </div>
        </TooltipProvider>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between border-t border-border/50 px-3 py-1">
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onUpload}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Upload file"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Upload files (Ctrl+U)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onNewFolder}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="New folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>New Folder</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Create folder (Ctrl+Shift+N)</TooltipContent>
            </Tooltip>

            {selectedCount > 0 && (
              <>
                <div className="mx-1 h-4 w-px bg-border" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onDownloadSelected}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label="Download selected"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Download selected</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onDeleteSelected}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                      aria-label="Delete selected"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Delete selected</TooltipContent>
                </Tooltip>
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {selectedCount} selected
                </span>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'rounded-l-md p-1.5 transition-colors',
                    viewMode === 'list'
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label="List view"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">List view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'rounded-r-md p-1.5 transition-colors',
                    viewMode === 'grid'
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Grid view</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
