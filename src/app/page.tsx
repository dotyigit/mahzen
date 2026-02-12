'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { AnimatePresence } from 'motion/react'
import { Upload } from 'lucide-react'
import { type S3Object, s3EntryToObject } from '@/lib/s3-types'
import { BucketSidebar } from '@/components/bucket-sidebar'
import { BrowserToolbar } from '@/components/browser-toolbar'
import { FileTable } from '@/components/file-table'
import { DetailPanel } from '@/components/detail-panel'
import { StatusBar } from '@/components/status-bar'
import { WelcomeScreen } from '@/components/welcome-screen'
import { AddSourceDialog } from '@/components/add-source-dialog'
import { UploadDialog, type StagedFile } from '@/components/upload-dialog'
import { NewFolderDialog } from '@/components/new-folder-dialog'
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog'
import { PresignDialog } from '@/components/presign-dialog'
import { TransfersPanel } from '@/components/transfers-panel'
import { SettingsDialog } from '@/components/settings-dialog'
import { TitleBar } from '@/components/title-bar'
import { useActiveTransferCount } from '@/lib/transfer-store'
import { transferStore } from '@/lib/transfer-store'
import { targetsList, targetBucketsList, targetObjectsListPage, targetObjectsListRecursive, targetObjectsDelete, targetBucketStats, isTauriRuntime, settingsGet, listDirectoryFiles } from '@/lib/tauri'
import type { AppSettings, SidebarBucket } from '@/lib/types'
import { toast } from 'sonner'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 12,
  dateFormat: 'relative',
  sizeFormat: 'binary',
  showFileIcons: true,
  compactMode: false,
  animateTransitions: true,
  doubleClickNav: true,
  showHidden: false,
  rememberPath: true,
  autoRefresh: false,
  confirmDelete: true,
  concurrentUploads: 3,
  concurrentDownloads: 5,
  multipartThresholdMb: 100,
  partSizeMb: 8,
  autoRetry: true,
  retryCount: 3,
  preserveTimestamps: true,
  verifyChecksum: true,
}

export default function Page() {
  // Flat bucket list from all targets
  const [sidebarBuckets, setSidebarBuckets] = useState<SidebarBucket[]>([])
  const [selectedBucket, setSelectedBucket] = useState<SidebarBucket | null>(null)
  const [isBucketsLoading, setIsBucketsLoading] = useState(false)

  // Object browser state
  const [objects, setObjects] = useState<S3Object[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [history, setHistory] = useState<string[]>([''])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [detailObject, setDetailObject] = useState<S3Object | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isObjectsLoading, setIsObjectsLoading] = useState(false)

  // Pagination state
  const [continuationToken, setContinuationToken] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const PAGE_SIZE = 200

  // Settings state
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const { setTheme } = useTheme()
  const rememberedPaths = useRef<Map<string, string>>(new Map())
  const loadRequestId = useRef(0)

  // Dialog states
  const [addSourceOpen, setAddSourceOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [transfersExpanded, setTransfersExpanded] = useState(false)
  const [pendingDeleteKeys, setPendingDeleteKeys] = useState<string[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [presignOpen, setPresignOpen] = useState(false)
  const [presignObject, setPresignObject] = useState<S3Object | null>(null)

  // Drag-drop state
  const [isDragging, setIsDragging] = useState(false)
  const [uploadInitialFiles, setUploadInitialFiles] = useState<StagedFile[]>([])

  const activeTransferCount = useActiveTransferCount()

  // Sync detail panel with selection: when the panel is open and a single
  // item is selected, update the panel to show that item.
  useEffect(() => {
    if (!detailObject) return
    if (selectedKeys.size === 1) {
      const selectedKey = Array.from(selectedKeys)[0]
      if (selectedKey !== detailObject.key) {
        const obj = objects.find((o) => o.key === selectedKey)
        if (obj) setDetailObject(obj)
      }
    }
  }, [selectedKeys, objects, detailObject])

  // Auto-expand transfers panel when a new transfer starts
  useEffect(() => {
    if (activeTransferCount > 0 && !transfersExpanded) {
      setTransfersExpanded(true)
    }
  }, [activeTransferCount, transfersExpanded])

  // Load settings on mount
  useEffect(() => {
    if (!isTauriRuntime()) return
    settingsGet()
      .then((s) => setSettings(s))
      .catch(() => {})
  }, [])

  // Sync theme with next-themes when settings change
  useEffect(() => {
    setTheme(settings.theme)
  }, [settings.theme, setTheme])

  // Load all targets and their buckets into a flat list
  const loadAllBuckets = useCallback(async () => {
    setIsBucketsLoading(true)
    try {
      const targets = await targetsList()
      const allBuckets: SidebarBucket[] = []

      // Fetch buckets for each target in parallel
      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const buckets = await targetBucketsList(target.id)
          return buckets.map((b) => ({
            name: b.name,
            region: target.region || 'auto',
            targetId: target.id,
            targetName: target.name,
            provider: target.provider,
            objectCount: null,
            totalSize: null,
          }))
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allBuckets.push(...result.value)
        }
      }

      setSidebarBuckets(allBuckets)

      // Load stats for each bucket sequentially to avoid S3 rate limiting
      const loadBucketStats = async (buckets: SidebarBucket[]) => {
        for (const bucket of buckets) {
          try {
            const stats = await targetBucketStats(bucket.targetId, bucket.name)
            setSidebarBuckets((prev) =>
              prev.map((b) =>
                b.targetId === bucket.targetId && b.name === bucket.name
                  ? { ...b, objectCount: stats.objectCount, totalSize: stats.totalSize }
                  : b,
              ),
            )
          } catch (_e) {
            // silently ignore stats failures — sidebar still shows buckets
          }
        }
      }
      loadBucketStats(allBuckets)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Failed to load buckets', { description: msg })
    } finally {
      setIsBucketsLoading(false)
    }
  }, [])

  const loadObjects = useCallback(async (targetId: string, bucket: string, prefix: string) => {
    const requestId = ++loadRequestId.current
    setIsObjectsLoading(true)
    setSelectedKeys(new Set())
    setDetailObject(null)
    setContinuationToken(null)
    setHasMore(false)
    try {
      const page = await targetObjectsListPage(targetId, bucket, prefix, PAGE_SIZE, null)
      if (requestId !== loadRequestId.current) return
      setObjects(page.entries.map(s3EntryToObject))
      setContinuationToken(page.nextContinuationToken)
      setHasMore(page.isTruncated)
    } catch (err) {
      if (requestId !== loadRequestId.current) return
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Failed to load objects', { description: msg })
      setObjects([])
    } finally {
      if (requestId === loadRequestId.current) {
        setIsObjectsLoading(false)
      }
    }
  }, [])

  const loadMoreObjects = useCallback(async () => {
    if (!selectedBucket || !hasMore || !continuationToken || isLoadingMore) return
    const requestId = loadRequestId.current
    setIsLoadingMore(true)
    try {
      const page = await targetObjectsListPage(selectedBucket.targetId, selectedBucket.name, currentPath, PAGE_SIZE, continuationToken)
      if (requestId !== loadRequestId.current) return
      setObjects(prev => [...prev, ...page.entries.map(s3EntryToObject)])
      setContinuationToken(page.nextContinuationToken)
      setHasMore(page.isTruncated)
    } catch (err) {
      if (requestId !== loadRequestId.current) return
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Failed to load more objects', { description: msg })
    } finally {
      if (requestId === loadRequestId.current) {
        setIsLoadingMore(false)
      }
    }
  }, [selectedBucket, hasMore, continuationToken, isLoadingMore, currentPath])

  // Auto-refresh timer
  useEffect(() => {
    if (!settings.autoRefresh || !selectedBucket) return
    const interval = setInterval(() => {
      loadObjects(selectedBucket.targetId, selectedBucket.name, currentPath)
    }, 30_000)
    return () => clearInterval(interval)
  }, [settings.autoRefresh, selectedBucket, currentPath, loadObjects])

  // Tauri native drag-drop listener
  useEffect(() => {
    if (!isTauriRuntime()) return
    let unlisten: (() => void) | undefined

    import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (event.payload.type === 'enter') {
          setIsDragging(true)
        } else if (event.payload.type === 'leave') {
          setIsDragging(false)
        } else if (event.payload.type === 'drop') {
          setIsDragging(false)
          const paths = event.payload.paths
          if (!paths || paths.length === 0) return

          if (!selectedBucket) {
            toast.info('Select a bucket first to upload files')
            return
          }

          // Convert dropped paths to StagedFile[] and expand directories
          const processDroppedPaths = async () => {
            const staged: StagedFile[] = []

            for (const p of paths) {
              try {
                // Try expanding as directory first
                const files = await listDirectoryFiles(p)
                if (files.length > 0) {
                  const folderName = p.split('/').pop() || p.split('\\').pop() || p
                  for (const f of files) {
                    const relativePath = `${folderName}/${f.relativePath.replace(/\\/g, '/')}`
                    const name = f.relativePath.split('/').pop() || f.relativePath.split('\\').pop() || f.relativePath
                    staged.push({
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      name,
                      path: f.absolutePath,
                      relativePath,
                      size: f.size,
                    })
                  }
                } else {
                  // Treat as single file
                  const name = p.split('/').pop() || p.split('\\').pop() || p
                  staged.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    name,
                    path: p,
                    relativePath: name,
                    size: 0,
                  })
                }
              } catch {
                // Not a directory, treat as single file
                const name = p.split('/').pop() || p.split('\\').pop() || p
                staged.push({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  name,
                  path: p,
                  relativePath: name,
                  size: 0,
                })
              }
            }

            if (staged.length > 0) {
              setUploadInitialFiles(staged)
              setUploadOpen(true)
            }
          }

          processDroppedPaths()
        }
      }).then((fn) => { unlisten = fn })
    })

    return () => { unlisten?.() }
  }, [selectedBucket])

  // Load buckets on mount
  useEffect(() => {
    if (!isTauriRuntime()) return
    loadAllBuckets()
  }, [loadAllBuckets])

  // Load objects when bucket or path changes
  useEffect(() => {
    if (!selectedBucket || !isTauriRuntime()) {
      setObjects([])
      return
    }
    loadObjects(selectedBucket.targetId, selectedBucket.name, currentPath)
  }, [selectedBucket, currentPath, loadObjects])

  const filteredObjects = useMemo(() => {
    let result = objects
    // Filter hidden files (starting with .)
    if (!settings.showHidden) {
      result = result.filter((item) => !item.name.startsWith('.'))
    }
    if (searchQuery) {
      result = result.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }
    return result
  }, [objects, searchQuery, settings.showHidden])

  const handleSelectBucket = useCallback((bucket: SidebarBucket) => {
    // Remember current path for the old bucket
    if (selectedBucket && settings.rememberPath && currentPath) {
      rememberedPaths.current.set(`${selectedBucket.targetId}:${selectedBucket.name}`, currentPath)
    }
    setSelectedBucket(bucket)
    // Restore remembered path if available
    const remembered = settings.rememberPath
      ? rememberedPaths.current.get(`${bucket.targetId}:${bucket.name}`) || ''
      : ''
    setCurrentPath(remembered)
    setHistory([remembered])
    setHistoryIndex(0)
    setSelectedKeys(new Set())
    setDetailObject(null)
    setSearchQuery('')
  }, [selectedBucket, currentPath, settings.rememberPath])

  const navigateTo = useCallback(
    (path: string) => {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(path)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      setCurrentPath(path)
      setSelectedKeys(new Set())
      setSearchQuery('')
    },
    [history, historyIndex],
  )

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCurrentPath(history[newIndex])
      setSelectedKeys(new Set())
    }
  }, [history, historyIndex])

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setCurrentPath(history[newIndex])
      setSelectedKeys(new Set())
    }
  }, [history, historyIndex])

  const goUp = useCallback(() => {
    if (currentPath === '') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    const parentPath = parts.length > 0 ? `${parts.join('/')}/` : ''
    navigateTo(parentPath)
  }, [currentPath, navigateTo])

  const handleRefresh = useCallback(() => {
    if (!selectedBucket) return
    setIsRefreshing(true)
    loadObjects(selectedBucket.targetId, selectedBucket.name, currentPath).finally(() => {
      setIsRefreshing(false)
    })
  }, [selectedBucket, currentPath, loadObjects])

  const handleRefreshBuckets = useCallback(() => {
    loadAllBuckets()
  }, [loadAllBuckets])

  const handleShowDetails = useCallback((obj: S3Object) => {
    setDetailObject(obj)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setDetailObject(null)
  }, [])

  const handleDeleteBucket = useCallback((_bucket: SidebarBucket) => {
    // TODO: implement bucket deletion
    toast.info('Bucket deletion not yet implemented')
  }, [])

  const handleDeleteObjects = useCallback(async (keys: string[]) => {
    if (!selectedBucket || keys.length === 0) return
    if (!settings.confirmDelete) {
      // Skip confirmation dialog — delete directly
      try {
        await targetObjectsDelete(selectedBucket.targetId, selectedBucket.name, keys)
        toast.success(`Deleted ${keys.length} item${keys.length > 1 ? 's' : ''}`)
        setSelectedKeys(new Set())
        setDetailObject(null)
        handleRefresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error('Failed to delete', { description: msg })
      }
      return
    }
    setPendingDeleteKeys(keys)
    setDeleteConfirmOpen(true)
  }, [selectedBucket, settings.confirmDelete, handleRefresh])

  const confirmDeleteObjects = useCallback(async () => {
    if (!selectedBucket || pendingDeleteKeys.length === 0) return
    try {
      await targetObjectsDelete(selectedBucket.targetId, selectedBucket.name, pendingDeleteKeys)
      toast.success(`Deleted ${pendingDeleteKeys.length} item${pendingDeleteKeys.length > 1 ? 's' : ''}`)
      setSelectedKeys(new Set())
      setDetailObject(null)
      setPendingDeleteKeys([])
      handleRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Failed to delete', { description: msg })
    }
  }, [selectedBucket, pendingDeleteKeys, handleRefresh])

  const handleDownloadObject = useCallback(async (obj: S3Object) => {
    if (!selectedBucket || obj.type === 'folder') return

    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const destPath = await save({
        defaultPath: obj.name,
      })
      if (!destPath) return

      transferStore.addTransfer('download', obj.name, obj.key, selectedBucket.name, obj.size, selectedBucket.targetId, undefined, destPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Download failed', { description: msg })
    }
  }, [selectedBucket])

  const handleDeleteSelected = useCallback(() => {
    const keys = Array.from(selectedKeys)
    if (keys.length === 0) return
    handleDeleteObjects(keys)
  }, [selectedKeys, handleDeleteObjects])

  const handleDownloadSelected = useCallback(async () => {
    if (!selectedBucket || selectedKeys.size === 0) return

    const selectedObjs = objects.filter((o) => selectedKeys.has(o.key))
    const hasFolders = selectedObjs.some((o) => o.type === 'folder')

    // Single file without folders → use the normal single-file download
    if (selectedObjs.length === 1 && !hasFolders) {
      handleDownloadObject(selectedObjs[0])
      return
    }

    // Multi-file or folder selection → download as ZIP via transfer store
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const timestamp = new Date().toISOString().slice(0, 10)
      const destPath = await save({
        defaultPath: `${selectedBucket.name}-${timestamp}.zip`,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      })
      if (!destPath) return

      toast.info('Preparing ZIP download...', { description: 'Collecting file list' })

      // Collect all keys and total size: files directly + expand folders recursively
      const allKeys: string[] = []
      let totalSize = 0
      for (const obj of selectedObjs) {
        if (obj.type === 'folder') {
          const recursive = await targetObjectsListRecursive(selectedBucket.targetId, selectedBucket.name, obj.key)
          for (const entry of recursive) {
            allKeys.push(entry.key)
            totalSize += entry.size
          }
        } else {
          allKeys.push(obj.key)
          totalSize += obj.size
        }
      }

      if (allKeys.length === 0) {
        toast.info('No files to download', { description: 'Selected folders are empty' })
        return
      }

      const zipName = destPath.split('/').pop() || `${selectedBucket.name}.zip`
      transferStore.addZipTransfer(
        zipName,
        selectedBucket.name,
        allKeys,
        currentPath,
        selectedBucket.targetId,
        destPath,
        totalSize,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('ZIP download failed', { description: msg })
    }
  }, [objects, selectedKeys, selectedBucket, currentPath, handleDownloadObject])

  const handlePresignObject = useCallback((obj: S3Object) => {
    setPresignObject(obj)
    setPresignOpen(true)
  }, [])

  const handleSourceAdded = useCallback(() => {
    loadAllBuckets()
  }, [loadAllBuckets])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (e.key === 'Escape') {
        if (presignOpen) { setPresignOpen(false); return }
        if (settingsOpen) { setSettingsOpen(false); return }
        if (uploadOpen) { setUploadOpen(false); return }
        if (newFolderOpen) { setNewFolderOpen(false); return }
        if (addSourceOpen) { setAddSourceOpen(false); return }
        if (detailObject) { setDetailObject(null); return }
        setSelectedKeys(new Set())
        return
      }

      if (isInput) return

      // Backspace — go up
      if (e.key === 'Backspace' && selectedBucket && currentPath !== '') {
        e.preventDefault()
        goUp()
        return
      }

      // Alt+Left — go back
      if (e.key === 'ArrowLeft' && e.altKey && selectedBucket) {
        e.preventDefault()
        goBack()
        return
      }

      // Alt+Right — go forward
      if (e.key === 'ArrowRight' && e.altKey && selectedBucket) {
        e.preventDefault()
        goForward()
        return
      }

      // Cmd/Ctrl+A — select all
      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && selectedBucket) {
        e.preventDefault()
        setSelectedKeys(new Set(filteredObjects.map((o) => o.key)))
        return
      }

      // Cmd/Ctrl+U — upload
      if (e.key === 'u' && (e.ctrlKey || e.metaKey) && selectedBucket) {
        e.preventDefault()
        setUploadOpen(true)
        return
      }

      // Cmd/Ctrl+Shift+N — new folder
      if (e.key === 'N' && (e.ctrlKey || e.metaKey) && e.shiftKey && selectedBucket) {
        e.preventDefault()
        setNewFolderOpen(true)
        return
      }

      // Cmd/Ctrl+R — refresh
      if (e.key === 'r' && (e.ctrlKey || e.metaKey) && selectedBucket) {
        e.preventDefault()
        handleRefresh()
        return
      }

      // Cmd/Ctrl+D — download selected
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedKeys.size > 0 && selectedBucket) {
        e.preventDefault()
        handleDownloadSelected()
        return
      }

      // Cmd/Ctrl+I — show properties/details
      if (e.key === 'i' && (e.ctrlKey || e.metaKey) && selectedKeys.size === 1 && selectedBucket) {
        e.preventDefault()
        const selectedKey = Array.from(selectedKeys)[0]
        const obj = objects.find((o) => o.key === selectedKey)
        if (obj) setDetailObject(obj)
        return
      }

      // Cmd/Ctrl+, — open settings
      if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSettingsOpen(true)
        return
      }

      // Delete — delete selected
      if (e.key === 'Delete' && selectedKeys.size > 0 && selectedBucket) {
        e.preventDefault()
        handleDeleteSelected()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detailObject, selectedBucket, currentPath, goUp, goBack, goForward, filteredObjects, objects, uploadOpen, newFolderOpen, addSourceOpen, settingsOpen, presignOpen, selectedKeys, handleDeleteSelected, handleDownloadSelected, handleRefresh])

  const hasSelectedBucket = !!selectedBucket

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Title Bar */}
      <TitleBar />

      {/* Drag-Drop Overlay */}
      {isDragging && selectedBucket && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-primary/5 px-12 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Drop files to upload
            </p>
            <p className="text-xs text-muted-foreground">
              to {selectedBucket.name}/{currentPath}
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <BucketSidebar
        buckets={sidebarBuckets}
        selectedBucket={selectedBucket}
        isLoading={isBucketsLoading}
        onSelectBucket={handleSelectBucket}
        onAddSource={() => setAddSourceOpen(true)}
        onRefresh={handleRefreshBuckets}
        onDeleteBucket={handleDeleteBucket}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* Dialogs */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSettingsChange={setSettings} />
      <AddSourceDialog
        open={addSourceOpen}
        onOpenChange={setAddSourceOpen}
        onSourceAdded={handleSourceAdded}
      />
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        items={pendingDeleteKeys}
        onConfirm={confirmDeleteObjects}
      />
      {selectedBucket && (
        <>
          <UploadDialog
            open={uploadOpen}
            onOpenChange={(open) => {
              setUploadOpen(open)
              if (!open) setUploadInitialFiles([])
            }}
            targetId={selectedBucket.targetId}
            bucketName={selectedBucket.name}
            currentPath={currentPath}
            onUploadComplete={handleRefresh}
            initialFiles={uploadInitialFiles}
          />
          <NewFolderDialog
            open={newFolderOpen}
            onOpenChange={setNewFolderOpen}
            targetId={selectedBucket.targetId}
            bucketName={selectedBucket.name}
            currentPath={currentPath}
            onFolderCreated={handleRefresh}
          />
          {presignObject && (
            <PresignDialog
              open={presignOpen}
              onOpenChange={setPresignOpen}
              targetId={selectedBucket.targetId}
              bucketName={selectedBucket.name}
              objectKey={presignObject.key}
              objectName={presignObject.name}
            />
          )}
        </>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {hasSelectedBucket ? (
          <>
            {/* Toolbar */}
            <BrowserToolbar
              bucketName={selectedBucket.name}
              currentPath={currentPath}
              onNavigate={navigateTo}
              onGoBack={goBack}
              onGoForward={goForward}
              onGoUp={goUp}
              canGoBack={historyIndex > 0}
              canGoForward={historyIndex < history.length - 1}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedCount={selectedKeys.size}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing || isObjectsLoading}
              onUpload={() => setUploadOpen(true)}
              onNewFolder={() => setNewFolderOpen(true)}
              onDeleteSelected={handleDeleteSelected}
              onDownloadSelected={handleDownloadSelected}
            />

            {/* File Browser + Detail Panel */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className={`flex flex-1 transition-opacity duration-300 ${isRefreshing || isObjectsLoading ? 'opacity-50' : 'opacity-100'}`}>
                <FileTable
                  objects={filteredObjects}
                  onNavigate={navigateTo}
                  selectedKeys={selectedKeys}
                  onSelectionChange={setSelectedKeys}
                  viewMode={viewMode}
                  onShowDetails={handleShowDetails}
                  onClearDetails={handleCloseDetails}
                  bucketName={selectedBucket.name}
                  onDelete={handleDeleteObjects}
                  onDownload={handleDownloadObject}
                  onPresign={handlePresignObject}
                  doubleClickNav={settings.doubleClickNav}
                  showFileIcons={settings.showFileIcons}
                  dateFormat={settings.dateFormat as 'relative' | 'absolute' | 'iso'}
                  sizeFormat={settings.sizeFormat as 'binary' | 'decimal'}
                  fontSize={settings.fontSize}
                  compactMode={settings.compactMode}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={loadMoreObjects}
                />
              </div>
              <AnimatePresence>
                {detailObject && (
                  <DetailPanel
                    key="detail-panel"
                    object={detailObject}
                    bucketName={selectedBucket.name}
                    targetId={selectedBucket.targetId}
                    onClose={handleCloseDetails}
                    onDownload={handleDownloadObject}
                    onPresign={handlePresignObject}
                    onNavigate={navigateTo}
                    sizeFormat={settings.sizeFormat as 'binary' | 'decimal'}
                    dateFormat={settings.dateFormat as 'relative' | 'absolute' | 'iso'}
                    compactMode={settings.compactMode}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Transfers Panel */}
            <TransfersPanel
              isExpanded={transfersExpanded}
              onToggle={() => setTransfersExpanded((prev) => !prev)}
            />

            {/* Status Bar */}
            <StatusBar
              targetRegion={selectedBucket.region}
              objects={filteredObjects}
              selectedCount={selectedKeys.size}
              currentPath={currentPath}
              activeTransferCount={activeTransferCount}
              onToggleTransfers={() => setTransfersExpanded((prev) => !prev)}
              sizeFormat={settings.sizeFormat as 'binary' | 'decimal'}
              compactMode={settings.compactMode}
            />
          </>
        ) : (
          <WelcomeScreen onAddSource={() => setAddSourceOpen(true)} />
        )}
      </div>
      </div>
    </div>
  )
}
