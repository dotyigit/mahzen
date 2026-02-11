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
import { FolderPlus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { targetFolderCreate } from '@/lib/tauri'

interface NewFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetId: string
  bucketName: string
  currentPath: string
  onFolderCreated: () => void
}

const INVALID_CHARS = /[\\{}^%`\[\]"<>~#|]/
const RESERVED_NAMES = ['.', '..']

export function NewFolderDialog({ open, onOpenChange, targetId, bucketName, currentPath, onFolderCreated }: NewFolderDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError(null)
      setIsCreating(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const validate = (value: string): string | null => {
    if (value.trim() === '') return null
    if (value.length > 1024) return 'Folder name must be under 1024 characters'
    if (INVALID_CHARS.test(value)) return 'Contains invalid characters: \\ { } ^ % ` [ ] " < > ~ # |'
    if (RESERVED_NAMES.includes(value.trim())) return 'Reserved name - cannot use "." or ".."'
    if (value.startsWith('/') || value.startsWith('\\')) return 'Name cannot start with a slash'
    if (value.includes('//')) return 'Name cannot contain consecutive slashes'
    return null
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    setError(validate(val))
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || error) return

    setIsCreating(true)
    try {
      const key = `${currentPath}${trimmed}`
      await targetFolderCreate(targetId, bucketName, key)
      toast.success('Folder created', {
        description: `${currentPath}${trimmed}/ created in ${bucketName}`,
      })
      onFolderCreated()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Failed to create folder', { description: msg })
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !error && !isCreating) {
      handleCreate()
    }
  }

  const fullPath = `${bucketName}/${currentPath}${name.trim() ? `${name.trim()}/` : ''}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <FolderPlus className="h-4 w-4 text-primary" />
            Create New Folder
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            Create a folder in <span className="font-mono text-foreground">{bucketName}/{currentPath}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col px-6 py-4">
          <div className="space-y-1.5">
            <label htmlFor="folder-name" className="text-xs font-medium text-foreground">
              Folder Name
            </label>
            <input
              ref={inputRef}
              id="folder-name"
              type="text"
              placeholder="my-folder"
              value={name}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors',
                error
                  ? 'border-destructive/50 focus:border-destructive focus:ring-destructive/30'
                  : 'border-border focus:border-primary/50 focus:ring-primary/30',
              )}
            />
            {error && (
              <div className="flex items-center gap-1.5 text-destructive animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                <p className="text-[11px]">{error}</p>
              </div>
            )}
          </div>

          {name.trim() && !error && (
            <div className="mt-3 rounded-md border border-border/50 bg-secondary/30 px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Full path</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{fullPath}</p>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            S3 folders are virtual -- they are created by adding a trailing slash to the key prefix.
            The folder will appear once objects are uploaded into it.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || !!error || isCreating}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Creating...
              </span>
            ) : (
              <>
                <FolderPlus className="h-3.5 w-3.5" />
                Create Folder
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
