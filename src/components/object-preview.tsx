'use client'

import { useState, useEffect } from 'react'
import { targetObjectPresign } from '@/lib/tauri'
import { Loader2, ImageIcon, Film, Music, FileText, FileCode } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

type PreviewCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text'

interface ObjectPreviewProps {
  targetId: string
  bucketName: string
  objectKey: string
  category: PreviewCategory
}

const TEXT_MAX_LINES = 200

export function getPreviewCategory(name: string): PreviewCategory | null {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  const videoExts = ['mp4', 'webm', 'mov']
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac']
  const pdfExts = ['pdf']
  const textExts = ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml', 'css', 'html', 'js', 'ts', 'csv', 'log']

  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  if (pdfExts.includes(ext)) return 'pdf'
  if (textExts.includes(ext)) return 'text'
  return null
}

function PreviewIcon({ category }: { category: PreviewCategory }) {
  switch (category) {
    case 'image': return <ImageIcon className="h-3.5 w-3.5" />
    case 'video': return <Film className="h-3.5 w-3.5" />
    case 'audio': return <Music className="h-3.5 w-3.5" />
    case 'pdf': return <FileText className="h-3.5 w-3.5" />
    case 'text': return <FileCode className="h-3.5 w-3.5" />
  }
}

export function ObjectPreview({ targetId, bucketName, objectKey, category }: ObjectPreviewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [textContent, setTextContent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setUrl(null)
    setTextContent(null)

    targetObjectPresign(targetId, bucketName, objectKey, 300)
      .then(async (presignedUrl) => {
        if (cancelled) return
        setUrl(presignedUrl)

        if (category === 'text') {
          try {
            const resp = await fetch(presignedUrl)
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            const text = await resp.text()
            const lines = text.split('\n')
            const truncated = lines.slice(0, TEXT_MAX_LINES).join('\n')
            if (!cancelled) {
              setTextContent(lines.length > TEXT_MAX_LINES ? `${truncated}\n\n... (${lines.length - TEXT_MAX_LINES} more lines)` : truncated)
            }
          } catch (e) {
            if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to fetch text content')
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to generate presigned URL')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [targetId, bucketName, objectKey, category])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Silently hide preview on any error (unsupported format, CORS, network, etc.)
  if (error) {
    return null
  }

  if (!url) return null

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2">
        <PreviewIcon category={category} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</span>
      </div>

      <div className="px-4 pb-3">
        {category === 'image' && (
          <img
            src={url}
            alt={objectKey.split('/').pop() || 'Preview'}
            className="max-h-48 w-full rounded-md border border-border object-contain bg-secondary/30"
            onError={() => setError('Failed to load image')}
          />
        )}

        {category === 'video' && (
          <video
            src={url}
            controls
            className="max-h-48 w-full rounded-md border border-border bg-black"
            onError={() => setError('Failed to load video')}
          >
            <track kind="captions" />
          </video>
        )}

        {category === 'audio' && (
          <audio
            src={url}
            controls
            className="w-full"
            onError={() => setError('Failed to load audio')}
          >
            <track kind="captions" />
          </audio>
        )}

        {category === 'pdf' && (
          <iframe
            src={url}
            title="PDF Preview"
            className="h-64 w-full rounded-md border border-border"
          />
        )}

        {category === 'text' && textContent !== null && (
          <ScrollArea className="max-h-48 rounded-md border border-border bg-secondary/30">
            <pre className="p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-all">
              {textContent}
            </pre>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
