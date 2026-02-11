"use client";

import { FolderOpen, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/app-context";
import { BucketCard } from "@/components/content/bucket-card";
import { EmptyState } from "@/components/content/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function BucketsView() {
  const { buckets, isBucketLoading, bucketError, selectedTarget, selectBucket } = useApp();

  if (!selectedTarget) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No target selected"
        description="Select a storage target from the sidebar to view its buckets."
      />
    );
  }

  if (isBucketLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading buckets...
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (bucketError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">{bucketError}</p>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No buckets found"
        description="This target has no accessible buckets, or the connection may need testing."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {buckets.map((bucket) => (
        <BucketCard
          key={bucket.name}
          bucket={bucket}
          onClick={() => selectBucket(bucket.name)}
        />
      ))}
    </div>
  );
}
