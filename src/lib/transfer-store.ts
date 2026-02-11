'use client'

import { useSyncExternalStore } from 'react'

export type TransferStatus = 'queued' | 'active' | 'completed' | 'failed' | 'cancelled'
export type TransferType = 'upload' | 'download'

export interface Transfer {
  id: string
  type: TransferType
  name: string
  key: string
  bucket: string
  size: number
  progress: number
  speed: number
  status: TransferStatus
  error?: string
  startedAt: number
  completedAt?: number
  targetId: string
  sourcePath?: string
  destPath?: string
}

type Listener = () => void

let transfers: Transfer[] = []
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function executeTransfer(id: string) {
  const t = transfers.find((tr) => tr.id === id)
  if (!t || t.status === 'cancelled') return

  // Mark as active
  transfers = transfers.map((tr) =>
    tr.id === id ? { ...tr, status: 'active' as TransferStatus } : tr,
  )
  emit()

  try {
    // Dynamic import to avoid SSR issues
    const { targetObjectUpload, targetObjectDownload } = await import('@/lib/tauri')

    if (t.type === 'upload' && t.sourcePath) {
      await targetObjectUpload(t.targetId, t.bucket, t.key, t.sourcePath)
    } else if (t.type === 'download' && t.destPath) {
      await targetObjectDownload(t.targetId, t.bucket, t.key, t.destPath)
    } else {
      throw new Error(`Missing ${t.type === 'upload' ? 'source path' : 'destination path'} for transfer`)
    }

    // Mark as completed
    transfers = transfers.map((tr) =>
      tr.id === id
        ? { ...tr, progress: 100, speed: 0, status: 'completed' as TransferStatus, completedAt: Date.now() }
        : tr,
    )
    emit()
  } catch (err) {
    // Check if cancelled during execution
    const current = transfers.find((tr) => tr.id === id)
    if (current?.status === 'cancelled') return

    const msg = err instanceof Error ? err.message : String(err)
    transfers = transfers.map((tr) =>
      tr.id === id
        ? { ...tr, speed: 0, status: 'failed' as TransferStatus, error: msg, completedAt: Date.now() }
        : tr,
    )
    emit()
  }
}

export const transferStore = {
  getSnapshot(): Transfer[] {
    return transfers
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  addTransfer(
    type: TransferType,
    name: string,
    key: string,
    bucket: string,
    size: number,
    targetId: string,
    sourcePath?: string,
    destPath?: string,
  ): string {
    const id = generateId()
    const transfer: Transfer = {
      id,
      type,
      name,
      key,
      bucket,
      size,
      progress: 0,
      speed: 0,
      status: 'queued',
      startedAt: Date.now(),
      targetId,
      sourcePath,
      destPath,
    }
    transfers = [transfer, ...transfers]
    emit()

    // Execute the transfer
    executeTransfer(id)

    return id
  },

  cancelTransfer(id: string) {
    transfers = transfers.map((t) =>
      t.id === id && (t.status === 'queued' || t.status === 'active')
        ? { ...t, status: 'cancelled' as TransferStatus, completedAt: Date.now() }
        : t,
    )
    emit()
  },

  retryTransfer(id: string) {
    const transfer = transfers.find((t) => t.id === id)
    if (transfer && (transfer.status === 'failed' || transfer.status === 'cancelled')) {
      transfers = transfers.map((t) =>
        t.id === id
          ? { ...t, status: 'queued' as TransferStatus, progress: 0, speed: 0, error: undefined, startedAt: Date.now(), completedAt: undefined }
          : t,
      )
      emit()
      executeTransfer(id)
    }
  },

  removeTransfer(id: string) {
    transfers = transfers.filter((t) => t.id !== id)
    emit()
  },

  clearCompleted() {
    transfers = transfers.filter(
      (t) => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled',
    )
    emit()
  },
}

export function useTransfers(): Transfer[] {
  return useSyncExternalStore(
    transferStore.subscribe,
    transferStore.getSnapshot,
    transferStore.getSnapshot,
  )
}

export function useActiveTransferCount(): number {
  const transfers = useTransfers()
  return transfers.filter((t) => t.status === 'active' || t.status === 'queued').length
}
