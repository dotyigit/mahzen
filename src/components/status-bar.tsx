'use client'

import { Folder, FileText, HardDrive, Clock, ArrowUpDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { type S3Object, formatBytes } from '@/lib/s3-types'

interface StatusBarProps {
  targetRegion: string | null
  objects: S3Object[]
  selectedCount: number
  currentPath: string
  activeTransferCount: number
  onToggleTransfers: () => void
  sizeFormat?: 'binary' | 'decimal'
  compactMode?: boolean
}

export function StatusBar({ targetRegion, objects, selectedCount, currentPath, activeTransferCount, onToggleTransfers, sizeFormat = 'binary', compactMode = false }: StatusBarProps) {
  const folderCount = objects.filter((o) => o.type === 'folder').length
  const fileCount = objects.filter((o) => o.type === 'file').length
  const totalSize = objects.filter((o) => o.type === 'file').reduce((acc, o) => acc + o.size, 0)

  return (
    <div className={cn('relative z-10 flex items-center justify-between border-t border-border bg-card px-4', compactMode ? 'py-0.5' : 'py-1.5')}>
      <div className="flex items-center gap-4">
        {targetRegion && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            {targetRegion}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Folder className="h-3 w-3" />
          {folderCount} folder{folderCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileText className="h-3 w-3" />
          {fileCount} file{fileCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatBytes(totalSize, sizeFormat)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.span
              key="selection-count"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="text-[11px] font-medium text-primary"
            >
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </motion.span>
          )}
        </AnimatePresence>
        {currentPath && (
          <span className="max-w-64 truncate font-mono text-[10px] text-muted-foreground/60">
            /{currentPath}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleTransfers}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-secondary',
            activeTransferCount > 0 ? 'text-primary' : 'text-muted-foreground',
          )}
          aria-label="Toggle transfers panel"
        >
          <ArrowUpDown className="h-3 w-3" />
          {activeTransferCount > 0 && (
            <span className="font-medium">{activeTransferCount}</span>
          )}
        </button>
      </div>
    </div>
  )
}
