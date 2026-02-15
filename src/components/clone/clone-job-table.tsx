"use client";

import { Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCloneJobs } from "@/lib/clone-store";
import { formatBytes } from "@/lib/format";
import { CloneStatusBadge } from "./clone-status-badge";
import type { CloneJob } from "@/lib/types";

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export type CloneActions = {
  onPause: (jobId: string) => Promise<void>;
  onResume: (jobId: string) => Promise<void>;
  onCancel: (jobId: string) => Promise<void>;
  onDelete: (jobId: string) => Promise<void>;
  onRetryFailed: (jobId: string) => Promise<void>;
};

function JobRow({ job, actions }: { job: CloneJob; actions: CloneActions }) {
  const liveJobs = useCloneJobs();
  const live = liveJobs.get(job.id);

  const totalItems = live?.totalItems ?? job.totalItems;
  const completedItems = live?.completedItems ?? job.completedItems;
  const failedItems = live?.failedItems ?? job.failedItems;
  const skippedItems = live?.skippedItems ?? job.skippedItems;
  const totalBytes = live?.totalBytes ?? job.totalBytes;
  const transferredBytes = live?.transferredBytes ?? job.transferredBytes;
  const status = live?.status ?? job.status;
  const speed = live?.speed ?? 0;
  const eta = live?.eta ?? null;

  const processedItems = completedItems + failedItems + skippedItems;
  const progress = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

  const isActive = status === "running" || status === "enumerating";
  const isPaused = status === "paused";
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled";

  const sourceLabel = job.sourcePrefix
    ? `${job.sourceBucket}/${job.sourcePrefix}`
    : job.sourceBucket;
  const destLabel = job.destPrefix
    ? `${job.destBucket}/${job.destPrefix}`
    : job.destBucket;

  const handleAction = async (action: () => Promise<void>, errorMsg: string) => {
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorMsg);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <CloneStatusBadge status={status} />
          {job.isSameTarget && (
            <span className="text-[10px] text-muted-foreground">server-side</span>
          )}
        </div>
        <div className="truncate text-muted-foreground">
          <span className="font-mono">{sourceLabel}</span>
          <span className="mx-1.5">→</span>
          <span className="font-mono">{destLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="shrink-0 tabular-nums">{progress}%</span>
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span>{processedItems.toLocaleString()} / {totalItems.toLocaleString()} items</span>
          <span>{formatBytes(transferredBytes)} / {formatBytes(totalBytes)}</span>
          {isActive && <span>{formatSpeed(speed)}</span>}
          {isActive && <span>ETA {formatEta(eta)}</span>}
          {failedItems > 0 && (
            <span className="text-destructive">{failedItems} failed</span>
          )}
          {skippedItems > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">{skippedItems} skipped</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleAction(() => actions.onPause(job.id), "Failed to pause")}
            title="Pause"
          >
            <Pause className="h-3 w-3" />
          </Button>
        )}
        {isPaused && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleAction(() => actions.onResume(job.id), "Failed to resume")}
            title="Resume"
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
        {isTerminal && failedItems > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleAction(() => actions.onRetryFailed(job.id), "Failed to retry")}
            title="Retry failed items"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        {(isActive || isPaused) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleAction(() => actions.onCancel(job.id), "Failed to cancel")}
            title="Cancel"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {isTerminal && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleAction(() => actions.onDelete(job.id), "Failed to delete")}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export type CloneJobTableProps = {
  jobs: CloneJob[];
  actions: CloneActions;
};

export function CloneJobTable({ jobs, actions }: CloneJobTableProps) {
  if (jobs.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No clone jobs yet
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[180px]">
      <div className="flex flex-col gap-2">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} actions={actions} />
        ))}
      </div>
    </ScrollArea>
  );
}
