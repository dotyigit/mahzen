'use client'

import React from "react"

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Database,
  Search,
  Globe,
  HardDrive,
  Plus,
  Settings,
  RefreshCw,
  Trash2,
  Copy,
  FileText,
  Tag,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/s3-types'
import type { SidebarBucket } from '@/lib/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { toast } from 'sonner'

interface BucketSidebarProps {
  buckets: SidebarBucket[]
  selectedBucket: SidebarBucket | null
  isLoading: boolean
  onSelectBucket: (bucket: SidebarBucket) => void
  onAddSource: () => void
  onRefresh: () => void
  onDeleteBucket: (bucket: SidebarBucket) => void
  onSettings: () => void
}

function BucketContextMenu({ children, bucket, onRefresh, onDelete }: { children: React.ReactNode; bucket: SidebarBucket; onRefresh: () => void; onDelete: () => void }) {
  const bucketArn = `arn:aws:s3:::${bucket.name}`
  const s3Uri = `s3://${bucket.name}`

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${label}`, {
      description: text.length > 60 ? `${text.slice(0, 60)}...` : text,
    })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2 text-xs">
            <Copy className="h-3.5 w-3.5" />
            Copy to Clipboard
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyText(bucket.name, 'Bucket Name')}>
              <FileText className="h-3.5 w-3.5" />
              Copy Bucket Name
            </ContextMenuItem>
            <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyText(s3Uri, 'S3 URI')}>
              <Tag className="h-3.5 w-3.5" />
              Copy S3 URI
            </ContextMenuItem>
            <ContextMenuItem className="gap-2 text-xs" onSelect={() => copyText(bucketArn, 'ARN')}>
              <FileText className="h-3.5 w-3.5" />
              Copy ARN
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2 text-xs" onSelect={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2 text-xs text-destructive focus:text-destructive" onSelect={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete Bucket
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function BucketSidebar({ buckets, selectedBucket, isLoading, onSelectBucket, onAddSource, onRefresh, onDeleteBucket, onSettings }: BucketSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBuckets = buckets.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground">S3 Buckets</span>
        </div>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-30"
                  aria-label="Refresh buckets"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAddSource}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  aria-label="Add source"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Add Source</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter buckets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-sidebar-accent/50 py-1.5 pl-8 pr-3 text-xs text-sidebar-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Bucket List */}
      <ScrollArea className="flex-1 px-2">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="mt-2 text-xs">Loading buckets...</span>
          </motion.div>
        ) : buckets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"
          >
            <Database className="h-5 w-5 opacity-40" />
            <span className="mt-2 text-xs">No buckets found</span>
            <span className="mt-1 text-[10px]">Add a source to get started</span>
          </motion.div>
        ) : (
          <div className="space-y-0.5 pb-2">
            <AnimatePresence initial={false}>
              {filteredBuckets.map((bucket, index) => {
                const isSelected = selectedBucket?.name === bucket.name && selectedBucket?.targetId === bucket.targetId
                return (
                  <motion.div
                    key={`${bucket.targetId}:${bucket.name}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, delay: index * 0.03 }}
                  >
                    <BucketContextMenu bucket={bucket} onRefresh={onRefresh} onDelete={() => onDeleteBucket(bucket)}>
                      <button
                        type="button"
                        onClick={() => onSelectBucket(bucket)}
                        className={cn(
                          'group flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-all duration-150',
                          isSelected
                            ? 'bg-primary/10 text-sidebar-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <HardDrive
                            className={cn(
                              'h-3.5 w-3.5 flex-shrink-0',
                              isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
                            )}
                          />
                          <span className="truncate text-xs font-medium">{bucket.name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 pl-[22px]">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Globe className="h-2.5 w-2.5" />
                            {bucket.region || 'auto'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {bucket.totalSize !== null ? formatBytes(bucket.totalSize) : '...'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {bucket.objectCount !== null ? `${bucket.objectCount.toLocaleString()} obj` : '...'}
                          </span>
                        </div>
                      </button>
                    </BucketContextMenu>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {buckets.length} bucket{buckets.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onSettings}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
