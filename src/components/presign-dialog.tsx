'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Share2, Copy, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { targetObjectPresign } from '@/lib/tauri'

interface PresignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetId: string
  bucketName: string
  objectKey: string
  objectName: string
}

const PRESETS = [
  { label: '1 hour', secs: 3600 },
  { label: '6 hours', secs: 21600 },
  { label: '12 hours', secs: 43200 },
  { label: '1 day', secs: 86400 },
  { label: '7 days', secs: 604800 },
] as const

export function PresignDialog({ open, onOpenChange, targetId, bucketName, objectKey, objectName }: PresignDialogProps) {
  const [selectedSecs, setSelectedSecs] = useState<number>(3600)
  const [customMinutes, setCustomMinutes] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedSecs(3600)
      setCustomMinutes('')
      setUseCustom(false)
      setIsGenerating(false)
      setGeneratedUrl(null)
      setCopied(false)
      setError(null)
    }
  }, [open])

  const effectiveSecs = useCustom ? (parseInt(customMinutes) || 0) * 60 : selectedSecs

  const handleGenerate = async () => {
    if (effectiveSecs <= 0) return

    setIsGenerating(true)
    setError(null)
    try {
      const url = await targetObjectPresign(targetId, bucketName, objectKey, effectiveSecs)
      setGeneratedUrl(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error('Failed to generate presigned URL', { description: msg })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    toast.success('Copied presigned URL')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelectPreset = (secs: number) => {
    setUseCustom(false)
    setSelectedSecs(secs)
    setGeneratedUrl(null)
    setError(null)
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '')
    setCustomMinutes(val)
    setUseCustom(true)
    setGeneratedUrl(null)
    setError(null)
  }

  const formatExpiry = (secs: number) => {
    if (secs < 3600) return `${Math.floor(secs / 60)} minutes`
    if (secs < 86400) return `${Math.floor(secs / 3600)} hours`
    return `${Math.floor(secs / 86400)} day${Math.floor(secs / 86400) > 1 ? 's' : ''}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Share2 className="h-4 w-4 text-primary" />
            Get Presigned URL
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            Generate a temporary shareable link for{' '}
            <span className="font-mono text-foreground">{objectName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col px-6 py-4">
          {/* Expiry selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Expires in</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.secs}
                  type="button"
                  onClick={() => handleSelectPreset(preset.secs)}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    !useCustom && selectedSecs === preset.secs
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div className="mt-3 space-y-1.5">
            <label htmlFor="custom-minutes" className="text-xs font-medium text-muted-foreground">
              Or enter custom (minutes)
            </label>
            <input
              id="custom-minutes"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 30"
              value={customMinutes}
              onChange={handleCustomChange}
              className={cn(
                'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors',
                useCustom
                  ? 'border-primary/50 focus:border-primary/50 focus:ring-primary/30'
                  : 'border-border focus:border-primary/50 focus:ring-primary/30',
              )}
            />
          </div>

          {/* Summary */}
          {effectiveSecs > 0 && (
            <div className="mt-3 rounded-md border border-border/50 bg-secondary/30 px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Link will expire</p>
              <p className="mt-1 font-mono text-xs text-foreground">{formatExpiry(effectiveSecs)} after generation</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-1.5 text-destructive animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <p className="text-[11px]">{error}</p>
            </div>
          )}

          {/* Generated URL */}
          {generatedUrl && (
            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="text-xs font-medium text-foreground">Presigned URL</label>
              <div className="relative">
                <textarea
                  ref={urlRef}
                  readOnly
                  value={generatedUrl}
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-secondary/30 px-3 py-2 font-mono text-[11px] text-foreground focus:outline-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-2 top-2 rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Copy URL"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {generatedUrl ? 'Done' : 'Cancel'}
          </button>
          {!generatedUrl && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={effectiveSecs <= 0 || isGenerating}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Generating...
                </span>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  Generate URL
                </>
              )}
            </button>
          )}
          {generatedUrl && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy URL
                </>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
