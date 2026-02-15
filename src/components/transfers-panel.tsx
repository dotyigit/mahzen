'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/s3-types'
import {
  useTransfers,
  transferStore,
  type Transfer,
  type TransferStatus,
} from '@/lib/transfer-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  ChevronUp,
  Upload,
  Download,
  X,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  ArrowUpDown,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  cloneJobList,
  clonePause,
  cloneResume,
  cloneCancel,
  cloneJobDelete,
  cloneRetryFailed,
  isTauriRuntime,
} from '@/lib/tauri'
import { CloneJobTable, type CloneActions } from '@/components/clone/clone-job-table'
import type { CloneJob } from '@/lib/types'

type FilterTab = 'all' | 'active' | 'completed' | 'failed'
type PanelTab = 'transfers' | 'clones'

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '--'
  return `${formatBytes(bytesPerSec)}/s`
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function formatDuration(start: number, end?: number): string {
  const ms = (end || Date.now()) - start
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = seconds % 60
  return `${minutes}m ${remainingSec}s`
}

function StatusIcon({ status }: { status: TransferStatus }) {
  switch (status) {
    case 'queued':
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    case 'active':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    case 'cancelled':
      return <Ban className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function AnimatedNumber({
  value,
  format,
  stiffness = 80,
  damping = 20,
}: {
  value: number
  format: (n: number) => string
  stiffness?: number
  damping?: number
}) {
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, { stiffness, damping })
  const [display, setDisplay] = useState(() => format(value))
  const formatRef = useRef(format)
  formatRef.current = format

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  useEffect(() => {
    return spring.on('change', (latest) => {
      setDisplay(formatRef.current(latest))
    })
  }, [spring])

  return <>{display}</>
}

function TransferRow({ transfer }: { transfer: Transfer }) {
  const isActive = transfer.status === 'active' || transfer.status === 'queued'
  const isDone = transfer.status === 'completed'
  const isFailed = transfer.status === 'failed'
  const isCancelled = transfer.status === 'cancelled'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'group flex flex-col gap-1.5 border-b border-border/30 px-4 py-2.5 transition-colors',
          isActive && 'bg-primary/[0.02]',
        )}
      >
        <div className="flex items-center gap-2.5">
          {/* Direction icon */}
          <div
            className={cn(
              'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md',
              transfer.type === 'upload'
                ? 'bg-primary/10 text-primary'
                : 'bg-emerald-500/10 text-emerald-400',
            )}
          >
            {transfer.type === 'upload' ? (
              <Upload className="h-3 w-3" />
            ) : (
              <Download className="h-3 w-3" />
            )}
          </div>

          {/* File info */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium text-foreground">{transfer.name}</span>
              <StatusIcon status={transfer.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-[10px] text-muted-foreground/60">
                {transfer.bucket}/{transfer.key}
              </span>
            </div>
          </div>

          {/* Size & Speed */}
          <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatBytes(transfer.size)}
            </span>
            {isActive && transfer.speed > 0 && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="font-mono text-[10px] text-primary"
              >
                <AnimatedNumber
                  value={transfer.speed}
                  format={formatSpeed}
                  stiffness={60}
                  damping={25}
                />
              </motion.span>
            )}
            {isDone && transfer.completedAt && (
              <span className="text-[10px] text-muted-foreground/60">
                {formatDuration(transfer.startedAt, transfer.completedAt)}
              </span>
            )}
            {(isFailed || isCancelled) && (
              <span className="text-[10px] text-muted-foreground/60">
                {formatTimeAgo(transfer.completedAt || transfer.startedAt)}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {isActive && (
              <button
                type="button"
                onClick={() => transferStore.cancelTransfer(transfer.id)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Cancel transfer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {(isFailed || isCancelled) && (
              <button
                type="button"
                onClick={() => transferStore.retryTransfer(transfer.id)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Retry transfer"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            {!isActive && (
              <button
                type="button"
                onClick={() => transferStore.removeTransfer(transfer.id)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove from list"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for active transfers */}
        {isActive && (
          <div className="flex items-center gap-2 pl-[34px]">
            <Progress
              value={transfer.progress}
              className="h-1 flex-1"
            />
            <span className="w-9 flex-shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              <AnimatedNumber
                value={transfer.progress}
                format={(n) => `${Math.round(n)}%`}
                stiffness={100}
                damping={25}
              />
            </span>
          </div>
        )}

        {/* Error message */}
        {isFailed && transfer.error && (
          <div className="flex items-center gap-1.5 pl-[34px]">
            <XCircle className="h-3 w-3 flex-shrink-0 text-destructive" />
            <span className="text-[10px] text-destructive">{transfer.error}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

interface TransfersPanelProps {
  isExpanded: boolean
  onToggle: () => void
}

export function TransfersPanel({ isExpanded, onToggle }: TransfersPanelProps) {
  const transfers = useTransfers()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [panelTab, setPanelTab] = useState<PanelTab>('transfers')
  const [cloneJobs, setCloneJobs] = useState<CloneJob[]>([])

  // Load clone jobs on mount and periodically
  const refreshCloneJobs = useCallback(async () => {
    if (!isTauriRuntime()) return
    try {
      setCloneJobs(await cloneJobList())
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    void refreshCloneJobs()
    const interval = setInterval(() => void refreshCloneJobs(), 3000)
    return () => clearInterval(interval)
  }, [refreshCloneJobs])

  const cloneActions: CloneActions = useMemo(() => ({
    onPause: async (jobId) => {
      await clonePause(jobId)
      await refreshCloneJobs()
    },
    onResume: async (jobId) => {
      await cloneResume(jobId)
      await refreshCloneJobs()
      toast.success('Clone job resumed')
    },
    onCancel: async (jobId) => {
      await cloneCancel(jobId)
      await refreshCloneJobs()
      toast.success('Clone job cancelled')
    },
    onDelete: async (jobId) => {
      await cloneJobDelete(jobId)
      await refreshCloneJobs()
      toast.success('Clone job deleted')
    },
    onRetryFailed: async (jobId) => {
      await cloneRetryFailed(jobId)
      await refreshCloneJobs()
      toast.success('Retrying failed items')
    },
  }), [refreshCloneJobs])

  const activeClones = useMemo(
    () => cloneJobs.filter((j) => j.status === 'running' || j.status === 'enumerating').length,
    [cloneJobs],
  )

  const counts = useMemo(() => ({
    all: transfers.length,
    active: transfers.filter((t) => t.status === 'active' || t.status === 'queued').length,
    completed: transfers.filter((t) => t.status === 'completed').length,
    failed: transfers.filter((t) => t.status === 'failed' || t.status === 'cancelled').length,
  }), [transfers])

  const filtered = useMemo(() => {
    switch (filter) {
      case 'active':
        return transfers.filter((t) => t.status === 'active' || t.status === 'queued')
      case 'completed':
        return transfers.filter((t) => t.status === 'completed')
      case 'failed':
        return transfers.filter((t) => t.status === 'failed' || t.status === 'cancelled')
      default:
        return transfers
    }
  }, [transfers, filter])

  const totalProgress = useMemo(() => {
    const active = transfers.filter((t) => t.status === 'active' || t.status === 'queued')
    if (active.length === 0) return -1
    return active.reduce((acc, t) => acc + t.progress, 0) / active.length
  }, [transfers])

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'completed', label: 'Done', count: counts.completed },
    { id: 'failed', label: 'Failed', count: counts.failed },
  ]

  return (
    <div className="flex flex-col overflow-hidden border-t border-border bg-card">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-2 transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-2.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Activity</span>
          <AnimatePresence mode="wait">
            {(counts.active > 0 || activeClones > 0) ? (
              <motion.span
                key="active-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {counts.active > 0 && <>{counts.active} transfer{counts.active !== 1 ? 's' : ''}</>}
                {counts.active > 0 && activeClones > 0 && <span className="mx-0.5">&middot;</span>}
                {activeClones > 0 && <>{activeClones} clone{activeClones !== 1 ? 's' : ''}</>}
              </motion.span>
            ) : (counts.all > 0 || cloneJobs.length > 0) ? (
              <motion.span
                key="total-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] text-muted-foreground"
              >
                {counts.all} transfer{counts.all !== 1 ? 's' : ''}
                {cloneJobs.length > 0 && <> &middot; {cloneJobs.length} clone{cloneJobs.length !== 1 ? 's' : ''}</>}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {/* Aggregate progress when collapsed */}
          <AnimatePresence>
            {!isExpanded && totalProgress >= 0 && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-2"
              >
                <Progress value={totalProgress} className="h-1 w-24" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  <AnimatedNumber
                    value={totalProgress}
                    format={(n) => `${Math.round(n)}%`}
                    stiffness={100}
                    damping={25}
                  />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="transfers-content"
            initial={{ height: 0 }}
            animate={{ height: 240 }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="flex h-[240px] flex-col">
              {/* Panel Tabs */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-border/50 border-t px-4 py-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPanelTab('transfers')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      panelTab === 'transfers'
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Transfers
                    {counts.all > 0 && (
                      <span className={cn(
                        'min-w-[16px] rounded-full px-1 py-px text-center text-[9px]',
                        panelTab === 'transfers' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                      )}>
                        {counts.all}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelTab('clones')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      panelTab === 'clones'
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    <Copy className="h-3 w-3" />
                    Clone Jobs
                    {cloneJobs.length > 0 && (
                      <span className={cn(
                        'min-w-[16px] rounded-full px-1 py-px text-center text-[9px]',
                        panelTab === 'clones' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                      )}>
                        {cloneJobs.length}
                      </span>
                    )}
                  </button>
                </div>

                {panelTab === 'transfers' && (counts.completed + counts.failed > 0) && (
                  <button
                    type="button"
                    onClick={() => transferStore.clearCompleted()}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear history
                  </button>
                )}
              </div>

              {/* Transfers Tab Content */}
              {panelTab === 'transfers' && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Transfer Filter Tabs */}
                  <div className="flex flex-shrink-0 items-center gap-0.5 border-b border-border/30 px-4 py-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        className={cn(
                          'flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                          filter === tab.id
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                        )}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span
                            className={cn(
                              'min-w-[16px] rounded-full px-1 py-px text-center text-[9px]',
                              filter === tab.id
                                ? 'bg-primary/15 text-primary'
                                : 'bg-secondary text-muted-foreground',
                            )}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Transfer list */}
                  {filtered.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <ArrowUpDown className="h-5 w-5 opacity-30" />
                      <p className="text-xs">
                        {filter === 'all'
                          ? 'No transfers yet'
                          : `No ${filter} transfers`}
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="min-h-0 flex-1">
                      <AnimatePresence initial={false}>
                        {filtered.map((transfer) => (
                          <TransferRow key={transfer.id} transfer={transfer} />
                        ))}
                      </AnimatePresence>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Clone Jobs Tab Content */}
              {panelTab === 'clones' && (
                <div className="flex-1 overflow-auto p-3">
                  <CloneJobTable jobs={cloneJobs} actions={cloneActions} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
