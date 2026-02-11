'use client'

import React, { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/s3-types'
import { FileIcon } from '@/components/file-icon'
import { transferStore } from '@/lib/transfer-store'
import { toast } from 'sonner'
import { isTauriRuntime, listDirectoryFiles } from '@/lib/tauri'
import {
  Upload,
  X,
  CloudUpload,
  FileUp,
  FolderUp,
  Trash2,
  AlertCircle,
} from 'lucide-react'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetId: string
  bucketName: string
  currentPath: string
  onUploadComplete: () => void
}

interface StagedFile {
  id: string
  name: string
  path: string
  relativePath: string
  size: number
}

export function UploadDialog({ open, onOpenChange, targetId, bucketName, currentPath, onUploadComplete }: UploadDialogProps) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleSelectFiles = useCallback(async () => {
    if (isTauriRuntime()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const selected = await open({ multiple: true, directory: false })
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected]
          const newFiles: StagedFile[] = paths.map((p) => {
            const name = p.split('/').pop() || p.split('\\').pop() || p
            return {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name,
              path: p,
              relativePath: name,
              size: 0, // size unknown until upload, show path instead
            }
          })
          setStagedFiles((prev) => [...prev, ...newFiles])
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error('Failed to open file dialog', { description: msg })
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [])

  const handleSelectFolder = useCallback(async () => {
    if (isTauriRuntime()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const selected = await open({ directory: true })
        if (selected) {
          const dirPath = Array.isArray(selected) ? selected[0] : selected
          const folderName = dirPath.split('/').pop() || dirPath.split('\\').pop() || dirPath

          // Expand the directory into individual file entries
          const files = await listDirectoryFiles(dirPath)
          if (files.length === 0) {
            toast.info('Folder is empty', { description: 'No files found in the selected folder.' })
            return
          }

          const newFiles: StagedFile[] = files.map((f) => {
            // Use forward slashes for S3 keys, keep folder name as prefix
            const relativePath = `${folderName}/${f.relativePath.replace(/\\/g, '/')}`
            const name = f.relativePath.split('/').pop() || f.relativePath.split('\\').pop() || f.relativePath
            return {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name,
              path: f.absolutePath,
              relativePath,
              size: f.size,
            }
          })

          setStagedFiles((prev) => [...prev, ...newFiles])
          toast.success(`${files.length} file${files.length > 1 ? 's' : ''} staged from ${folderName}/`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error('Failed to open folder dialog', { description: msg })
      }
    } else {
      folderInputRef.current?.click()
    }
  }, [])

  // Fallback: browser file input handler (web mode)
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: StagedFile[] = Array.from(e.target.files).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        path: '',
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        size: file.size,
      }))
      setStagedFiles((prev) => [...prev, ...newFiles])
    }
    e.target.value = ''
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      // Drag-and-drop in Tauri webview doesn't give file paths — show info
      if (isTauriRuntime()) {
        toast.info('Use the file/folder buttons to select files for upload')
      } else if (e.dataTransfer.files.length > 0) {
        const newFiles: StagedFile[] = Array.from(e.dataTransfer.files).map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          path: '',
          relativePath: file.name,
          size: file.size,
        }))
        setStagedFiles((prev) => [...prev, ...newFiles])
      }
    },
    [],
  )

  const removeFile = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setStagedFiles([])
  }, [])

  const handleUpload = useCallback(() => {
    if (stagedFiles.length === 0) return

    for (const staged of stagedFiles) {
      const key = currentPath + staged.relativePath
      transferStore.addTransfer('upload', staged.name, key, bucketName, staged.size, targetId, staged.path)
    }

    toast.success(`Uploading ${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}`, {
      description: `To ${bucketName}/${currentPath || ''}`,
    })

    setStagedFiles([])
    onOpenChange(false)
    onUploadComplete()
  }, [stagedFiles, currentPath, bucketName, targetId, onOpenChange, onUploadComplete])

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0)

  const handleClose = (val: boolean) => {
    if (!val) {
      setStagedFiles([])
      setIsDragOver(false)
    }
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="h-4 w-4 text-primary" />
            Upload Files
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            Upload to <span className="font-mono text-foreground">{bucketName}/{currentPath}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative mx-6 mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-all duration-200',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/30',
            )}
          >
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200',
                isDragOver ? 'bg-primary/10' : 'bg-secondary',
              )}
            >
              <CloudUpload
                className={cn(
                  'h-6 w-6 transition-colors duration-200',
                  isDragOver ? 'text-primary' : 'text-muted-foreground',
                )}
              />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {isDragOver ? 'Drop files here' : 'Select files to upload'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Use the buttons below to browse for files</p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectFiles}
                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                <FileUp className="h-3.5 w-3.5" />
                Select Files
              </button>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                <FolderUp className="h-3.5 w-3.5" />
                Select Folder
              </button>
            </div>

            {/* Hidden inputs for web fallback */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Staged Files List */}
          {stagedFiles.length > 0 && (
            <div className="mt-3 flex flex-col">
              <div className="flex items-center justify-between border-t border-border px-6 py-2">
                <span className="text-xs font-medium text-foreground">
                  {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''} staged
                  {totalSize > 0 && (
                    <span className="ml-1.5 text-muted-foreground">({formatBytes(totalSize)})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear all
                </button>
              </div>

              <ScrollArea className="max-h-48">
                <div className="px-6 pb-1">
                  {stagedFiles.map((staged) => (
                    <div
                      key={staged.id}
                      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
                    >
                      <FileIcon name={staged.name} type="file" className="h-3.5 w-3.5 flex-shrink-0" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs font-medium text-foreground">
                          {staged.relativePath || staged.name}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {staged.size > 0 ? formatBytes(staged.size) : staged.path || 'File'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(staged.id)}
                        className="flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label={`Remove ${staged.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Size warning */}
          {totalSize > 5 * 1024 * 1024 * 1024 && (
            <div className="mx-6 mt-2 flex items-center gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
              <p className="text-[11px] text-warning">
                Large upload detected. Consider using multipart upload for files over 5 GB.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-[11px] text-muted-foreground">
              {stagedFiles.length === 0
                ? 'No files selected'
                : `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''} ready`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={stagedFiles.length === 0}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload {stagedFiles.length > 0 ? `(${stagedFiles.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
