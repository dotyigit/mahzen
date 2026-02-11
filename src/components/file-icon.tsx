import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  File,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/s3-types'

interface FileIconProps {
  name: string
  type: 'folder' | 'file'
  className?: string
}

const iconMap: Record<string, { icon: typeof File; color: string }> = {
  folder: { icon: Folder, color: 'text-primary' },
  image: { icon: FileImage, color: 'text-emerald-400' },
  video: { icon: FileVideo, color: 'text-rose-400' },
  audio: { icon: FileAudio, color: 'text-amber-400' },
  code: { icon: FileCode, color: 'text-cyan-400' },
  document: { icon: FileText, color: 'text-orange-400' },
  archive: { icon: FileArchive, color: 'text-yellow-400' },
  file: { icon: File, color: 'text-muted-foreground' },
}

export function FileIcon({ name, type, className }: FileIconProps) {
  const kind = getFileIcon(name, type)
  const { icon: Icon, color } = iconMap[kind] || iconMap.file

  return <Icon className={cn('h-4 w-4', color, className)} />
}
