export const providerOptions = [
  "AWS S3",
  "Cloudflare R2",
  "DigitalOcean Spaces",
  "Hetzner Object Storage",
  "MinIO",
  "Other (S3 Compatible)",
] as const;

export type ProviderOption = (typeof providerOptions)[number];

export const conflictPolicies = [
  { value: "newestMtimeWins", label: "Newest wins (mtime)" },
  { value: "localAlwaysWins", label: "Local always wins" },
  { value: "remoteAlwaysWins", label: "Remote always wins" },
  { value: "skip", label: "Skip conflicts" },
] as const;

export const deletePolicies = [
  { value: "noPropagation", label: "No propagation" },
  { value: "propagate", label: "Propagate deletes" },
] as const;

export const transferStatuses = [
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled",
] as const;

export const terminalStatuses = ["completed", "failed", "cancelled"] as const;

export const cloneConflictPolicies = [
  { value: "skip", label: "Skip existing objects" },
  { value: "overwrite", label: "Overwrite all" },
  { value: "overwriteIfNewer", label: "Overwrite if source is newer" },
] as const;

export const cloneJobStatuses = [
  "pending",
  "enumerating",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export const shortcuts = {
  commandPalette: { key: "k", meta: true, label: "Cmd+K" },
  toggleSidebar: { key: "b", meta: true, label: "Cmd+B" },
  newTarget: { key: "n", meta: true, label: "Cmd+N" },
  refresh: { key: "r", meta: true, label: "Cmd+R" },
  toggleTransferPanel: { key: "j", meta: true, label: "Cmd+J" },
} as const;
