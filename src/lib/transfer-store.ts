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

// Storage for ZIP download metadata
const zipTransferKeys = new Map<string, string[]>()
const zipTransferPrefixes = new Map<string, string>()
const zipTransferTotalSizes = new Map<string, number>()

// Set up Tauri event listener for download progress (once)
let progressListenerInitialized = false
function initProgressListener() {
  if (progressListenerInitialized) return
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return
  progressListenerInitialized = true

  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<{ transferId: string; bytesDone: number; bytesTotal: number }>('download-progress', (event) => {
      const { transferId, bytesDone, bytesTotal } = event.payload
      const t = transfers.find((tr) => tr.id === transferId)
      if (!t || t.status !== 'active') return

      const elapsed = (Date.now() - t.startedAt) / 1000
      const progress = bytesTotal > 0 ? Math.min(Math.round((bytesDone / bytesTotal) * 100), 99) : 0
      const speed = elapsed > 0 ? bytesDone / elapsed : 0

      transfers = transfers.map((tr) =>
        tr.id === transferId
          ? { ...tr, progress, speed, size: bytesTotal > 0 ? bytesTotal : tr.size }
          : tr,
      )
      emit()
    })
  })
}

async function executeTransfer(id: string) {
  const t = transfers.find((tr) => tr.id === id)
  if (!t || t.status === 'cancelled') return

  // Mark as active
  transfers = transfers.map((tr) =>
    tr.id === id ? { ...tr, status: 'active' as TransferStatus, startedAt: Date.now() } : tr,
  )
  emit()

  try {
    // Dynamic import to avoid SSR issues
    const tauri = await import('@/lib/tauri')

    if (t.type === 'upload' && t.sourcePath) {
      await tauri.targetObjectUpload(t.targetId, t.bucket, t.key, t.sourcePath)
    } else if (t.type === 'download' && t.destPath) {
      if (t.key.startsWith('zip:')) {
        const keys = zipTransferKeys.get(id)
        const basePrefix = zipTransferPrefixes.get(id) || ''
        const totalSize = zipTransferTotalSizes.get(id) || 0
        if (!keys) throw new Error('ZIP download keys not found')
        const zipBytes = await tauri.targetObjectsDownloadZip(t.targetId, t.bucket, keys, basePrefix, t.destPath, id, totalSize)
        transfers = transfers.map((tr) =>
          tr.id === id ? { ...tr, size: zipBytes } : tr,
        )
        zipTransferKeys.delete(id)
        zipTransferPrefixes.delete(id)
        zipTransferTotalSizes.delete(id)
      } else {
        await tauri.targetObjectDownload(t.targetId, t.bucket, t.key, t.destPath, id)
      }
    } else {
      throw new Error(`Missing ${t.type === 'upload' ? 'source path' : 'destination path'} for transfer`)
    }

    // Mark as completed
    const completed = transfers.find((tr) => tr.id === id)
    transfers = transfers.map((tr) =>
      tr.id === id
        ? { ...tr, progress: 100, speed: 0, status: 'completed' as TransferStatus, completedAt: Date.now(), size: completed?.size || tr.size }
        : tr,
    )
    emit()
  } catch (err) {
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
    // Lazily initialize progress listener on first subscribe
    initProgressListener()
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

    executeTransfer(id)

    return id
  },

  addZipTransfer(
    name: string,
    bucket: string,
    keys: string[],
    basePrefix: string,
    targetId: string,
    destPath: string,
    totalSize: number,
  ): string {
    const id = generateId()
    const transfer: Transfer = {
      id,
      type: 'download',
      name,
      key: `zip:${keys.length}`,
      bucket,
      size: totalSize,
      progress: 0,
      speed: 0,
      status: 'queued',
      startedAt: Date.now(),
      targetId,
      destPath,
    }
    zipTransferKeys.set(id, keys)
    zipTransferPrefixes.set(id, basePrefix)
    zipTransferTotalSizes.set(id, totalSize)

    transfers = [transfer, ...transfers]
    emit()

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
