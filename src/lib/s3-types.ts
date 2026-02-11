import type { S3ObjectEntry } from '@/lib/types'

export interface S3Object {
  key: string
  name: string
  type: 'folder' | 'file'
  size: number
  lastModified: string
  storageClass?: string
  etag?: string
  contentType?: string
}

export function s3EntryToObject(entry: S3ObjectEntry): S3Object {
  return {
    key: entry.key,
    name: entry.name,
    type: entry.isFolder ? 'folder' : 'file',
    size: entry.size,
    lastModified: entry.lastModified || '',
    storageClass: entry.storageClass || undefined,
    etag: entry.etag || undefined,
    contentType: entry.contentType || undefined,
  }
}

export function formatBytes(bytes: number, format: 'binary' | 'decimal' = 'binary'): string {
  if (bytes === 0) return '0 B'
  const k = format === 'binary' ? 1024 : 1000
  const sizes = format === 'binary'
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    : ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

export function formatDate(dateStr: string, format: 'relative' | 'absolute' | 'iso' = 'relative'): string {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '--'

  if (format === 'iso') {
    return date.toISOString().replace('T', ' ').slice(0, 19)
  }

  if (format === 'absolute') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `${minutes}m ago`
    }
    return `${hours}h ago`
  }
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function getFileIcon(name: string, type: 'folder' | 'file'): string {
  if (type === 'folder') return 'folder'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp']
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm']
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac']
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'toml']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv']
  const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2']

  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  if (codeExts.includes(ext)) return 'code'
  if (docExts.includes(ext)) return 'document'
  if (archiveExts.includes(ext)) return 'archive'
  return 'file'
}
