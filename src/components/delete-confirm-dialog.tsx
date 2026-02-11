'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Trash2, AlertTriangle } from 'lucide-react'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: string[]
  onConfirm: () => void
}

export function DeleteConfirmDialog({ open, onOpenChange, items, onConfirm }: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    onConfirm()
    setIsDeleting(false)
    onOpenChange(false)
  }

  const displayItems = items.slice(0, 5)
  const remaining = items.length - displayItems.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Confirm Delete
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            This action cannot be undone. The following {items.length === 1 ? 'item' : `${items.length} items`} will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="rounded-md border border-border/50 bg-secondary/30 px-3 py-2">
            {displayItems.map((item) => {
              const name = item.split('/').filter(Boolean).pop() || item
              return (
                <p key={item} className="truncate font-mono text-xs text-foreground py-0.5">
                  {name}
                </p>
              )
            })}
            {remaining > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                ...and {remaining} more
              </p>
            )}
          </div>
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
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />
                Deleting...
              </span>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete {items.length > 1 ? `(${items.length})` : ''}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
