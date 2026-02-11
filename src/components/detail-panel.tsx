'use client'

import { X, Copy, ExternalLink, Tag, Shield, Clock, HardDrive, FileText, Check, Download, Share2 } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { type S3Object, formatBytes, formatDate } from '@/lib/s3-types'
import { FileIcon } from '@/components/file-icon'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DetailPanelProps {
  object: S3Object
  bucketName: string
  onClose: () => void
  onDownload: (obj: S3Object) => void
  onPresign?: (obj: S3Object) => void
  onNavigate?: (path: string) => void
  sizeFormat?: 'binary' | 'decimal'
  dateFormat?: 'relative' | 'absolute' | 'iso'
  compactMode?: boolean
}

function DetailRow({ label, value, mono, copyable, compact }: { label: string; value: string; mono?: boolean; copyable?: boolean; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`Copied ${label}`, { description: value.length > 60 ? `${value.slice(0, 60)}...` : value })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex flex-col gap-1 px-4', compact ? 'py-1.5' : 'py-2.5')}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs text-foreground ${mono ? 'font-mono' : ''} break-all`}>{value}</span>
        {copyable && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={`Copy ${label}`}
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">{copied ? 'Copied!' : 'Copy'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

export function DetailPanel({ object, bucketName, onClose, onDownload, onPresign, onNavigate, sizeFormat = 'binary', dateFormat = 'relative', compactMode = false }: DetailPanelProps) {
  const s3Uri = `s3://${bucketName}/${object.key}`
  const objectUrl = `https://${bucketName}.s3.amazonaws.com/${object.key}`
  const fullDate = object.lastModified
    ? new Date(object.lastModified).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      })
    : '--'

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex max-h-full flex-shrink-0 flex-col overflow-hidden border-l border-border bg-card"
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between border-b border-border px-4', compactMode ? 'py-2' : 'py-3')}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <FileIcon name={object.name} type={object.type} className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{object.name}</h3>
            <p className="text-[10px] text-muted-foreground">
              {object.type === 'folder' ? 'Folder' : object.contentType || 'File'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* Quick Info */}
        {object.type === 'file' && (
          <div className="grid grid-cols-2 gap-px border-b border-border bg-border/50">
            <div className={cn('flex flex-col items-center gap-1 bg-card px-3', compactMode ? 'py-2' : 'py-3')}>
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{formatBytes(object.size, sizeFormat)}</span>
              <span className="text-[10px] text-muted-foreground">Size</span>
            </div>
            <div className={cn('flex flex-col items-center gap-1 bg-card px-3', compactMode ? 'py-2' : 'py-3')}>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{formatDate(object.lastModified, dateFormat)}</span>
              <span className="text-[10px] text-muted-foreground">Modified</span>
            </div>
          </div>
        )}

        {/* General Section */}
        <div className="py-1">
          <div className="flex items-center gap-2 px-4 py-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">General</span>
          </div>
          <DetailRow compact={compactMode} label="Key" value={object.key} mono copyable />
          {object.type === 'file' && (
            <>
              <DetailRow compact={compactMode} label="Size" value={`${formatBytes(object.size, sizeFormat)} (${object.size.toLocaleString()} bytes)`} />
              <DetailRow compact={compactMode} label="Content Type" value={object.contentType || 'Unknown'} />
            </>
          )}
          <DetailRow compact={compactMode} label="Last Modified" value={fullDate} />
        </div>

        <div className="px-4">
          <Separator />
        </div>

        {/* Storage Section */}
        {object.storageClass && (
          <>
            <div className="py-1">
              <div className="flex items-center gap-2 px-4 py-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Storage</span>
              </div>
              <DetailRow compact={compactMode} label="Storage Class" value={object.storageClass} />
              {object.etag && <DetailRow compact={compactMode} label="ETag" value={object.etag} mono copyable />}
            </div>

            <div className="px-4">
              <Separator />
            </div>
          </>
        )}

        {/* Links Section */}
        <div className="py-1">
          <div className="flex items-center gap-2 px-4 py-2">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">References</span>
          </div>
          <DetailRow compact={compactMode} label="S3 URI" value={s3Uri} mono copyable />
          <DetailRow compact={compactMode} label="Object URL" value={objectUrl} mono copyable />
          <DetailRow compact={compactMode} label="ARN" value={`arn:aws:s3:::${bucketName}/${object.key}`} mono copyable />
        </div>

        {/* ETag section if present */}
        {object.etag && (
          <>
            <div className="px-4">
              <Separator />
            </div>
            <div className="py-1">
              <div className="flex items-center gap-2 px-4 py-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Metadata</span>
              </div>
              <DetailRow compact={compactMode} label="ETag (Full)" value={object.etag} mono copyable />
            </div>
          </>
        )}

        <div className="h-4" />
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex flex-shrink-0 gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={() => {
            if (object.type === 'folder' && onNavigate) {
              onNavigate(object.key)
            } else {
              onDownload(object)
            }
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {object.type === 'folder' ? (
            <>
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Download
            </>
          )}
        </button>
        {object.type === 'file' && onPresign && (
          <button
            type="button"
            onClick={() => onPresign(object)}
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(s3Uri)
            toast.success('Copied S3 URI', { description: s3Uri })
          }}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy URI
        </button>
      </div>
    </motion.div>
  )
}
