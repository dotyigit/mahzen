const units = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "0 B";
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(epoch: number | null | undefined): string {
  if (epoch == null) return "-";
  return new Date(epoch * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(epoch: number | null | undefined): string {
  if (epoch == null) return "-";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - epoch;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}
