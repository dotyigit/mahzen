'use client'

import React from "react"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Globe,
  Server,
  Cloud,
  Shield,
  Eye,
  EyeOff,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { targetsUpsert, targetCredentialsUpsert, targetConnectionTest, targetsDelete } from '@/lib/tauri'
import { parseEndpointForBucket } from '@/components/forms/target-form-schema'
import type { StorageTarget, TargetCredentials } from '@/lib/types'

type Provider = 'aws' | 'hetzner' | 'digitalocean' | 'cloudflare' | 'minio' | 'custom'

interface ProviderConfig {
  id: Provider
  name: string
  description: string
  icon: React.ReactNode
  color: string
  defaultEndpoint?: string
  regionPlaceholder: string
  regions?: string[]
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'aws',
    name: 'Amazon S3',
    description: 'Amazon Web Services S3 storage',
    icon: <Cloud className="h-5 w-5" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    regionPlaceholder: 'us-east-1',
    regions: [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
      'ap-east-1', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
      'sa-east-1', 'ca-central-1', 'me-south-1', 'af-south-1',
    ],
  },
  {
    id: 'hetzner',
    name: 'Hetzner Storage',
    description: 'Hetzner Object Storage (S3-compatible)',
    icon: <Server className="h-5 w-5" />,
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    defaultEndpoint: 'https://fsn1.your-objectstorage.com',
    regionPlaceholder: 'fsn1',
    regions: ['fsn1', 'nbg1', 'hel1'],
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean Spaces',
    description: 'DigitalOcean Spaces object storage',
    icon: <Globe className="h-5 w-5" />,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    defaultEndpoint: 'https://nyc3.digitaloceanspaces.com',
    regionPlaceholder: 'nyc3',
    regions: ['nyc3', 'sfo3', 'ams3', 'sgp1', 'fra1', 'syd1'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare R2',
    description: 'Cloudflare R2 zero-egress storage',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    defaultEndpoint: 'https://<account-id>.r2.cloudflarestorage.com',
    regionPlaceholder: 'auto',
    regions: ['auto'],
  },
  {
    id: 'minio',
    name: 'MinIO',
    description: 'Self-hosted MinIO object storage',
    icon: <Server className="h-5 w-5" />,
    color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    defaultEndpoint: 'http://localhost:9000',
    regionPlaceholder: 'us-east-1',
  },
  {
    id: 'custom',
    name: 'Custom S3',
    description: 'Any S3-compatible endpoint',
    icon: <Globe className="h-5 w-5" />,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    regionPlaceholder: 'us-east-1',
  },
]

interface FormData {
  name: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  region: string
  scopedBucket: string
  forcePathStyle: boolean
}

interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSourceAdded: () => void
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function AddSourceDialog({ open, onOpenChange, onSourceAdded }: AddSourceDialogProps) {
  const [step, setStep] = useState<'provider' | 'credentials'>('provider')
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [tempTargetId, setTempTargetId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    accessKeyId: '',
    secretAccessKey: '',
    endpoint: '',
    region: '',
    scopedBucket: '',
    forcePathStyle: false,
  })

  const provider = PROVIDERS.find((p) => p.id === selectedProvider)

  const resetDialog = () => {
    setStep('provider')
    setSelectedProvider(null)
    setShowSecret(false)
    setIsTesting(false)
    setIsSaving(false)
    setTestResult(null)
    setTestMessage('')
    setTempTargetId(null)
    setForm({
      name: '',
      accessKeyId: '',
      secretAccessKey: '',
      endpoint: '',
      region: '',
      scopedBucket: '',
      forcePathStyle: false,
    })
  }

  const handleProviderSelect = (providerId: Provider) => {
    const p = PROVIDERS.find((pr) => pr.id === providerId)
    setSelectedProvider(providerId)
    setForm((prev) => ({
      ...prev,
      endpoint: p?.defaultEndpoint || '',
      region: p?.regions?.[0] || '',
      name: '',
      forcePathStyle: providerId === 'minio',
    }))
    setStep('credentials')
  }

  const handleBack = () => {
    setStep('provider')
    setSelectedProvider(null)
    setTestResult(null)
    setTestMessage('')
  }

  const buildTarget = (id: string): StorageTarget => {
    let endpoint = selectedProvider === 'aws' ? '' : form.endpoint
    let scopedBucket = form.scopedBucket.trim() || null

    // Auto-detect bucket embedded in the endpoint URL
    if (endpoint) {
      const { baseEndpoint, extractedBucket } = parseEndpointForBucket(endpoint)
      if (extractedBucket) {
        endpoint = baseEndpoint
        if (!scopedBucket) scopedBucket = extractedBucket
      }
    }

    return {
      id,
      name: form.name || provider?.name || 'Unnamed',
      provider: provider?.name || 'Custom S3',
      endpoint,
      region: form.region || null,
      forcePathStyle: form.forcePathStyle,
      defaultBucket: null,
      scopedBucket,
      pinnedBuckets: [],
      skipDestructiveConfirmations: false,
      hasCredentials: true,
      updatedAt: Math.floor(Date.now() / 1000),
    }
  }

  const buildCredentials = (): TargetCredentials => ({
    accessKeyId: form.accessKeyId,
    secretAccessKey: form.secretAccessKey,
    sessionToken: null,
  })

  const saveTargetAndCredentials = async (id: string) => {
    const target = buildTarget(id)
    const credentials = buildCredentials()
    await targetsUpsert(target)
    await targetCredentialsUpsert(id, credentials)
    return id
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    setTestMessage('')

    try {
      const id = tempTargetId || generateId()
      if (!tempTargetId) setTempTargetId(id)
      await saveTargetAndCredentials(id)
      const result = await targetConnectionTest(id)

      if (result.ok) {
        setTestResult('success')
        setTestMessage(result.message)
        toast.success('Connection successful', { description: result.message })
      } else {
        setTestResult('error')
        setTestMessage(result.message)
        toast.error('Connection failed', { description: result.message })
      }
    } catch (err) {
      setTestResult('error')
      const msg = err instanceof Error ? err.message : String(err)
      setTestMessage(msg)
      toast.error('Connection failed', { description: msg })
      // Clean up temp target on failure
      if (tempTargetId) {
        try { await targetsDelete([tempTargetId]) } catch { /* ignore */ }
        setTempTargetId(null)
      }
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const id = tempTargetId || generateId()
      await saveTargetAndCredentials(id)
      toast.success('Source added', { description: `${provider?.name} source "${form.name || provider?.name}" has been saved.` })
      onSourceAdded()
      resetDialog()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Failed to save source', { description: msg })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = async (val: boolean) => {
    if (!val) {
      // Clean up temp target if user cancels without saving
      if (tempTargetId && testResult !== 'success') {
        try { await targetsDelete([tempTargetId]) } catch { /* ignore */ }
      }
      resetDialog()
    }
    onOpenChange(val)
  }

  const isFormValid = form.accessKeyId.trim() !== '' && form.secretAccessKey.trim() !== '' &&
    (selectedProvider === 'aws' ? form.region.trim() !== '' : form.endpoint.trim() !== '')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="max-w-4xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            {step === 'credentials' && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <DialogTitle className="text-sm font-semibold">
                {step === 'provider' ? 'Add S3-Compatible Source' : `Configure ${provider?.name}`}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {step === 'provider'
                  ? 'Select your storage provider to get started'
                  : 'Enter your credentials and endpoint configuration'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'provider' && (
          <div className="grid grid-cols-2 gap-3 p-6">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderSelect(p.id)}
                className={cn(
                  'group flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-all duration-150',
                  'hover:border-primary/30 hover:bg-primary/5',
                )}
              >
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border', p.color)}>
                  {p.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 'credentials' && provider && (
          <div className="flex flex-col">
            {/* Provider badge */}
            <div className="flex items-center gap-2 border-b border-border/50 bg-secondary/30 px-6 py-2.5">
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-md border', provider.color)}>
                {provider.icon}
              </div>
              <span className="text-xs font-medium text-foreground">{provider.name}</span>
            </div>

            <div className="space-y-4 p-6">
              {/* Connection Name */}
              <div className="space-y-1.5">
                <label htmlFor="source-name" className="text-xs font-medium text-foreground">
                  Connection Name
                </label>
                <input
                  id="source-name"
                  type="text"
                  placeholder={`My ${provider.name}`}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {/* Credentials Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="access-key" className="text-xs font-medium text-foreground">
                    Access Key ID <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="access-key"
                    type="text"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={form.accessKeyId}
                    onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="secret-key" className="text-xs font-medium text-foreground">
                    Secret Access Key <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="secret-key"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      value={form.secretAccessKey}
                      onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}
                    >
                      {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Endpoint & Region */}
              <div className="grid grid-cols-2 gap-3">
                {selectedProvider !== 'aws' && (
                  <div className="space-y-1.5">
                    <label htmlFor="endpoint" className="text-xs font-medium text-foreground">
                      Endpoint URL <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="endpoint"
                      type="text"
                      placeholder={provider.defaultEndpoint || 'https://s3.example.com'}
                      value={form.endpoint}
                      onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                )}
                <div className={cn('space-y-1.5', selectedProvider === 'aws' && 'col-span-2')}>
                  <label htmlFor="region" className="text-xs font-medium text-foreground">
                    Region {selectedProvider === 'aws' && <span className="text-destructive">*</span>}
                  </label>
                  {provider.regions ? (
                    <select
                      id="region"
                      value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                      className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      {provider.regions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="region"
                      type="text"
                      placeholder={provider.regionPlaceholder}
                      value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  )}
                </div>
              </div>

              {/* Bucket Scope */}
              <div className="space-y-1.5">
                <label htmlFor="scoped-bucket" className="text-xs font-medium text-foreground">
                  Bucket Scope
                </label>
                <input
                  id="scoped-bucket"
                  type="text"
                  placeholder="leave empty for all buckets"
                  value={form.scopedBucket}
                  onChange={(e) => setForm({ ...form, scopedBucket: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  Restrict this source to a single bucket. Use this when your keys only have access to one bucket.
                </p>
              </div>

              {/* Options */}
              {(selectedProvider === 'minio' || selectedProvider === 'custom') && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="path-style"
                    checked={form.forcePathStyle}
                    onChange={(e) => setForm({ ...form, forcePathStyle: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <label htmlFor="path-style" className="text-xs text-muted-foreground">
                    Force path-style addressing (required for most self-hosted S3)
                  </label>
                </div>
              )}

              {/* Security Notice */}
              <div className="flex items-start gap-2 rounded-md border border-border/50 bg-secondary/30 px-3 py-2.5">
                <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Credentials are encrypted and stored locally on your device. They are never sent to any third-party server.
                </p>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2.5',
                  testResult === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                    : 'border-destructive/20 bg-destructive/5 text-destructive',
                )}>
                  {testResult === 'success' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  <span className="text-xs font-medium">
                    {testMessage || (testResult === 'success'
                      ? 'Connection verified - buckets discovered successfully'
                      : 'Connection failed - check credentials and endpoint'
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!isFormValid || isTesting}
                className="flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
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
                  onClick={handleSave}
                  disabled={!isFormValid || isSaving}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add Source
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
