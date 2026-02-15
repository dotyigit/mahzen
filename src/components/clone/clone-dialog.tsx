"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cloneStart, isTauriRuntime, targetBucketsList, targetsList } from "@/lib/tauri";
import { cloneConflictPolicies } from "@/lib/constants";
import type { CloneJob, S3BucketSummary, StorageTarget } from "@/lib/types";

type CloneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSourceTargetId?: string;
  defaultSourceBucket?: string;
  defaultSourcePrefix?: string;
  onCloneStarted?: (job: CloneJob) => void;
};

export function CloneDialog({
  open,
  onOpenChange,
  defaultSourceTargetId,
  defaultSourceBucket,
  defaultSourcePrefix,
  onCloneStarted,
}: CloneDialogProps) {

  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [sourceTargetId, setSourceTargetId] = useState("");
  const [sourceBuckets, setSourceBuckets] = useState<S3BucketSummary[]>([]);
  const [sourceBucket, setSourceBucket] = useState("");
  const [sourcePrefix, setSourcePrefix] = useState("");

  const [destTargetId, setDestTargetId] = useState("");
  const [destBuckets, setDestBuckets] = useState<S3BucketSummary[]>([]);
  const [destBucket, setDestBucket] = useState("");
  const [destPrefix, setDestPrefix] = useState("");

  const [conflictPolicy, setConflictPolicy] = useState("skip");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSameTarget = sourceTargetId === destTargetId && sourceTargetId !== "";
  const isIdentical =
    isSameTarget && sourceBucket === destBucket && sourcePrefix === destPrefix;
  const isValid =
    sourceTargetId && sourceBucket && destTargetId && destBucket && !isIdentical;

  // Load targets on open
  useEffect(() => {
    if (!open || !isTauriRuntime()) return;
    targetsList()
      .then((t) => {
        setTargets(t);
        if (defaultSourceTargetId) {
          setSourceTargetId(defaultSourceTargetId);
        }
      })
      .catch(() => {});
  }, [open, defaultSourceTargetId]);

  // Pre-fill defaults
  useEffect(() => {
    if (open && defaultSourceBucket) {
      setSourceBucket(defaultSourceBucket);
    }
    if (open && defaultSourcePrefix) {
      setSourcePrefix(defaultSourcePrefix);
    }
  }, [open, defaultSourceBucket, defaultSourcePrefix]);

  // Fetch source buckets when source target changes
  useEffect(() => {
    if (!sourceTargetId || !isTauriRuntime()) {
      setSourceBuckets([]);
      return;
    }
    targetBucketsList(sourceTargetId)
      .then(setSourceBuckets)
      .catch(() => setSourceBuckets([]));
  }, [sourceTargetId]);

  // Fetch dest buckets when dest target changes
  useEffect(() => {
    if (!destTargetId || !isTauriRuntime()) {
      setDestBuckets([]);
      return;
    }
    targetBucketsList(destTargetId)
      .then(setDestBuckets)
      .catch(() => setDestBuckets([]));
  }, [destTargetId]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      const job = await cloneStart(
        sourceTargetId,
        sourceBucket,
        sourcePrefix,
        destTargetId,
        destBucket,
        destPrefix,
        conflictPolicy,
      );
      toast.success("Clone job started");
      onCloneStarted?.(job);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start clone");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid,
    sourceTargetId,
    sourceBucket,
    sourcePrefix,
    destTargetId,
    destBucket,
    destPrefix,
    conflictPolicy,
    onCloneStarted,
    onOpenChange,
  ]);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setSourceTargetId(defaultSourceTargetId ?? "");
      setSourceBucket(defaultSourceBucket ?? "");
      setSourcePrefix(defaultSourcePrefix ?? "");
      setDestTargetId("");
      setDestBucket("");
      setDestPrefix("");
      setConflictPolicy("skip");
    }
  }, [open, defaultSourceTargetId, defaultSourceBucket, defaultSourcePrefix]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Clone Bucket
          </DialogTitle>
          <DialogDescription>
            Copy objects between buckets.{" "}
            {isSameTarget && "Same target detected — will use server-side copy."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          {/* Source */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Source
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={sourceTargetId} onValueChange={(v) => { setSourceTargetId(v); setSourceBucket(""); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceBucket} onValueChange={setSourceBucket} disabled={!sourceTargetId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Bucket" />
                </SelectTrigger>
                <SelectContent>
                  {sourceBuckets.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Prefix (optional, e.g. images/)"
              value={sourcePrefix}
              onChange={(e) => setSourcePrefix(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Destination
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={destTargetId} onValueChange={(v) => { setDestTargetId(v); setDestBucket(""); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={destBucket} onValueChange={setDestBucket} disabled={!destTargetId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Bucket" />
                </SelectTrigger>
                <SelectContent>
                  {destBuckets.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Prefix (optional, e.g. backup/)"
              value={destPrefix}
              onChange={(e) => setDestPrefix(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Conflict Policy */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              If object already exists
            </Label>
            <Select value={conflictPolicy} onValueChange={setConflictPolicy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cloneConflictPolicies.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info badges */}
          {isSameTarget && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              <Zap className="h-3 w-3" />
              Server-side copy — no data transferred through your machine
            </div>
          )}
          {isIdentical && (
            <p className="text-[11px] text-destructive">
              Source and destination are identical
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {isSubmitting ? "Starting..." : "Start Clone"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
