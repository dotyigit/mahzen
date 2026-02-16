'use client'

import React from "react"

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Monitor,
  ArrowUpDown,
  Keyboard,
  Info,
  Check,
  RefreshCw,
  ExternalLink,
  Github,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { isTauriRuntime, settingsGet, settingsUpsert } from '@/lib/tauri'
import type { AppSettings } from '@/lib/types'

type SettingsTab = 'general' | 'transfers' | 'appearance' | 'shortcuts' | 'about'

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'transfers', label: 'Transfers', icon: ArrowUpDown },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
]

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

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsChange?: (settings: AppSettings) => void
}

type OnUpdate = (patch: Partial<AppSettings>) => void

// --- Setting row helpers ---

function SettingRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      {children}
    </div>
  )
}

function SettingLabel({
  label,
  description,
}: {
  label: string
  description?: string
}) {
  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {description && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

function ShortcutRow({
  label,
  keys,
}: {
  label: string
  keys: string[]
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={`${key}-${i}`}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-secondary px-1.5 font-mono text-[10px] text-secondary-foreground"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}

// --- Tab content components ---

function GeneralTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: OnUpdate }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Navigation
      </h3>
      <SettingRow>
        <SettingLabel
          label="Double-click to navigate"
          description="Open folders on double-click instead of single-click"
        />
        <Switch
          checked={settings.doubleClickNav}
          onCheckedChange={(v) => onUpdate({ doubleClickNav: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
      <SettingRow>
        <SettingLabel
          label="Remember last path"
          description="Restore previous folder when switching buckets"
        />
        <Switch
          checked={settings.rememberPath}
          onCheckedChange={(v) => onUpdate({ rememberPath: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
      <SettingRow>
        <SettingLabel
          label="Show hidden files"
          description="Display objects starting with a dot"
        />
        <Switch
          checked={settings.showHidden}
          onCheckedChange={(v) => onUpdate({ showHidden: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
      <SettingRow>
        <SettingLabel
          label="Auto-refresh"
          description="Periodically refresh the file list every 30 seconds"
        />
        <Switch
          checked={settings.autoRefresh}
          onCheckedChange={(v) => onUpdate({ autoRefresh: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Safety
      </h3>
      <SettingRow>
        <SettingLabel
          label="Confirm before deleting"
          description="Show a confirmation dialog before deleting objects"
        />
        <Switch
          checked={settings.confirmDelete}
          onCheckedChange={(v) => onUpdate({ confirmDelete: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
    </div>
  )
}

function TransfersTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: OnUpdate }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Concurrency
      </h3>
      <SettingRow>
        <SettingLabel
          label="Concurrent uploads"
          description="Maximum simultaneous upload operations"
        />
        <Select value={String(settings.concurrentUploads)} onValueChange={(v) => onUpdate({ concurrentUploads: Number(v) })}>
          <SelectTrigger className="h-7 w-20 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['1', '2', '3', '5', '8', '10'].map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow>
        <SettingLabel
          label="Concurrent downloads"
          description="Maximum simultaneous download operations"
        />
        <Select value={String(settings.concurrentDownloads)} onValueChange={(v) => onUpdate({ concurrentDownloads: Number(v) })}>
          <SelectTrigger className="h-7 w-20 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['1', '2', '3', '5', '8', '10'].map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Multipart
      </h3>
      <SettingRow>
        <SettingLabel
          label="Multipart threshold"
          description="Files larger than this will use multipart upload (MB)"
        />
        <Select value={String(settings.multipartThresholdMb)} onValueChange={(v) => onUpdate({ multipartThresholdMb: Number(v) })}>
          <SelectTrigger className="h-7 w-24 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['50', '100', '256', '512', '1024'].map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{v} MB</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow>
        <SettingLabel
          label="Part size"
          description="Size of each multipart upload chunk (MB)"
        />
        <Select value={String(settings.partSizeMb)} onValueChange={(v) => onUpdate({ partSizeMb: Number(v) })}>
          <SelectTrigger className="h-7 w-24 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['5', '8', '16', '32', '64'].map((v) => (
              <SelectItem key={v} value={v} className="text-xs">{v} MB</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Reliability
      </h3>
      <SettingRow>
        <SettingLabel
          label="Auto-retry failed transfers"
          description="Automatically retry operations that fail due to network issues"
        />
        <Switch
          checked={settings.autoRetry}
          onCheckedChange={(v) => onUpdate({ autoRetry: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
      {settings.autoRetry && (
        <SettingRow>
          <SettingLabel
            label="Maximum retries"
            description="Number of retry attempts before marking as failed"
          />
          <Select value={String(settings.retryCount)} onValueChange={(v) => onUpdate({ retryCount: Number(v) })}>
            <SelectTrigger className="h-7 w-20 border-border bg-secondary text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['1', '2', '3', '5', '10'].map((v) => (
                <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      )}
      <SettingRow>
        <SettingLabel
          label="Verify checksum"
          description="Validate file integrity after transfer using MD5/ETag"
        />
        <Switch
          checked={settings.verifyChecksum}
          onCheckedChange={(v) => onUpdate({ verifyChecksum: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
      <SettingRow>
        <SettingLabel
          label="Preserve timestamps"
          description="Keep original file modification timestamps on upload"
        />
        <Switch
          checked={settings.preserveTimestamps}
          onCheckedChange={(v) => onUpdate({ preserveTimestamps: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
    </div>
  )
}

function AppearanceTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: OnUpdate }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Theme
      </h3>
      <SettingRow>
        <SettingLabel label="Color theme" description="Application color scheme" />
        <Select value={settings.theme} onValueChange={(v) => onUpdate({ theme: v })}>
          <SelectTrigger className="h-7 w-28 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark" className="text-xs">Dark</SelectItem>
            <SelectItem value="light" className="text-xs">Light</SelectItem>
            <SelectItem value="system" className="text-xs">System</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow>
        <SettingLabel label="Compact mode" description="Reduce padding and spacing throughout the UI" />
        <Switch
          checked={settings.compactMode}
          onCheckedChange={(v) => onUpdate({ compactMode: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
      <SettingRow>
        <SettingLabel label="Animate transitions" description="Enable smooth UI transitions and animations" />
        <Switch
          checked={settings.animateTransitions}
          onCheckedChange={(v) => onUpdate({ animateTransitions: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Display
      </h3>
      <SettingRow>
        <SettingLabel label="Font size" description="Base text size in the file browser" />
        <Select value={String(settings.fontSize)} onValueChange={(v) => onUpdate({ fontSize: Number(v) })}>
          <SelectTrigger className="h-7 w-24 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="11" className="text-xs">11px</SelectItem>
            <SelectItem value="12" className="text-xs">12px</SelectItem>
            <SelectItem value="13" className="text-xs">13px</SelectItem>
            <SelectItem value="14" className="text-xs">14px</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow>
        <SettingLabel label="Date format" description="How timestamps are displayed" />
        <Select value={settings.dateFormat} onValueChange={(v) => onUpdate({ dateFormat: v })}>
          <SelectTrigger className="h-7 w-28 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relative" className="text-xs">Relative</SelectItem>
            <SelectItem value="absolute" className="text-xs">Absolute</SelectItem>
            <SelectItem value="iso" className="text-xs">ISO 8601</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow>
        <SettingLabel label="Size format" description="Binary (1024) or decimal (1000) units" />
        <Select value={settings.sizeFormat} onValueChange={(v) => onUpdate({ sizeFormat: v })}>
          <SelectTrigger className="h-7 w-28 border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="binary" className="text-xs">Binary (KiB)</SelectItem>
            <SelectItem value="decimal" className="text-xs">Decimal (KB)</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow>
        <SettingLabel label="Show file type icons" description="Display colored icons based on file extension" />
        <Switch
          checked={settings.showFileIcons}
          onCheckedChange={(v) => onUpdate({ showFileIcons: v })}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
        />
      </SettingRow>
    </div>
  )
}

function ShortcutsTab() {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Navigation
      </h3>
      <ShortcutRow label="Go back" keys={['Alt', '\u2190']} />
      <ShortcutRow label="Go forward" keys={['Alt', '\u2192']} />
      <ShortcutRow label="Go up one level" keys={['Backspace']} />
      <ShortcutRow label="Refresh" keys={['\u2318', 'R']} />

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Selection
      </h3>
      <ShortcutRow label="Select all" keys={['\u2318', 'A']} />
      <ShortcutRow label="Deselect all" keys={['Escape']} />

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Actions
      </h3>
      <ShortcutRow label="Upload files" keys={['\u2318', 'U']} />
      <ShortcutRow label="New folder" keys={['\u2318', '\u21E7', 'N']} />
      <ShortcutRow label="Download selected" keys={['\u2318', 'D']} />
      <ShortcutRow label="Properties" keys={['\u2318', 'I']} />
      <ShortcutRow label="Delete" keys={['Del']} />

      <Separator className="my-3" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Application
      </h3>
      <ShortcutRow label="Settings" keys={['\u2318', ',']} />
      <ShortcutRow label="Close panel / dialog" keys={['Escape']} />
    </div>
  )
}

function AboutTab() {
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'installing' | 'upToDate' | 'error' | 'unavailable'>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    if (!isTauriRuntime()) return
    import('@tauri-apps/api/app').then(({ getVersion }) => {
      getVersion().then(setAppVersion).catch(() => {})
    })
  }, [])

  const checkForUpdates = async () => {
    if (!isTauriRuntime()) return

    setUpdateState('checking')
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update) {
        setUpdateVersion(update.version)
        setUpdateState('available')
      } else {
        setUpdateState('upToDate')
        setTimeout(() => setUpdateState('idle'), 4000)
      }
    } catch (e) {
      const msg = String(e).toLowerCase()
      if (msg.includes('platform') || msg.includes('target') || msg.includes('not found')) {
        setUpdateState('unavailable')
      } else {
        setUpdateState('error')
      }
      setTimeout(() => setUpdateState('idle'), 6000)
    }
  }

  const installUpdate = async () => {
    if (!isTauriRuntime()) return

    setUpdateState('installing')
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update) {
        await update.downloadAndInstall()
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      }
    } catch {
      setUpdateState('error')
      setTimeout(() => setUpdateState('idle'), 4000)
    }
  }

  const displayVersion = appVersion || '2.0.0'

  return (
    <div className="space-y-5">
      {/* App identity */}
      <div className="flex items-start gap-4">
        <img src="/app-icon.png" alt="Mahzen" className="h-12 w-12 flex-shrink-0 rounded-xl" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Mahzen</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            A desktop file manager for S3-compatible object storage.
            Browse, upload, download, and manage your cloud objects.
          </p>
        </div>
      </div>

      <Separator />

      {/* Version info + update */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Version {displayVersion}
          </span>
          {updateState === 'upToDate' && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              Latest
            </span>
          )}
          {updateState === 'available' && (
            <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-500">
              v{updateVersion} available
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            · Tauri v2 + Next.js
          </span>
        </div>
        <div className="mt-2.5">
          {updateState === 'available' ? (
            <button
              type="button"
              onClick={installUpdate}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" />
              Install & Restart
            </button>
          ) : (
            <button
              type="button"
              onClick={checkForUpdates}
              disabled={updateState === 'checking' || updateState === 'installing'}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                updateState === 'upToDate'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : updateState === 'error' || updateState === 'unavailable'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-secondary text-foreground hover:bg-secondary/80',
              )}
            >
              {updateState === 'checking' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking...
                </>
              ) : updateState === 'installing' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Installing...
                </>
              ) : updateState === 'upToDate' ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Up to date
                </>
              ) : updateState === 'unavailable' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  No update for this platform
                </>
              ) : updateState === 'error' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Check failed — try again
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Check for Updates
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <Separator />

      {/* Links */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Resources
        </h3>
        <div className="flex flex-col gap-0.5">
          {[
            { label: 'Source Code', icon: Github, href: 'https://github.com/dotyigit/mahzen' },
            { label: 'Release Notes', icon: Download, href: 'https://github.com/dotyigit/mahzen/releases' },
            { label: 'Report a Bug', icon: ExternalLink, href: 'https://github.com/dotyigit/mahzen/issues' },
            { label: 'Discussions', icon: ExternalLink, href: 'https://github.com/dotyigit/mahzen/discussions' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </span>
              <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-1 text-center">
        <p className="text-[10px] text-muted-foreground/60">
          Made with care. Licensed under MIT.
        </p>
      </div>
    </div>
  )
}

// --- Main dialog ---

export function SettingsDialog({ open, onOpenChange, onSettingsChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  // Load settings from backend when dialog opens
  useEffect(() => {
    if (!open || !isTauriRuntime()) return
    let cancelled = false
    settingsGet()
      .then((s) => { if (!cancelled) setSettings(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open])

  // Persist a partial update: merge into local state, then notify parent
  const handleUpdate = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (isTauriRuntime()) {
        settingsUpsert(next).catch(() => {})
      }
      // Defer parent notification to avoid setState-during-render
      queueMicrotask(() => onSettingsChange?.(next))
      return next
    })
  }, [onSettingsChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[540px] max-w-2xl gap-0 overflow-hidden border-border bg-card p-0">
        {/* Sidebar nav */}
        <div className="flex w-44 flex-shrink-0 flex-col border-r border-border bg-background/50 p-2">
          <DialogHeader className="px-2 pb-3 pt-2">
            <DialogTitle className="text-xs font-semibold text-foreground">Settings</DialogTitle>
          </DialogHeader>
          <nav className="flex flex-col gap-0.5" aria-label="Settings sections">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-5">
              {activeTab === 'general' && <GeneralTab settings={settings} onUpdate={handleUpdate} />}
              {activeTab === 'transfers' && <TransfersTab settings={settings} onUpdate={handleUpdate} />}
              {activeTab === 'appearance' && <AppearanceTab settings={settings} onUpdate={handleUpdate} />}
              {activeTab === 'shortcuts' && <ShortcutsTab />}
              {activeTab === 'about' && <AboutTab />}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
