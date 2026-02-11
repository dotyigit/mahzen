"use client";

import { FolderOpen } from "lucide-react";
import { useApp } from "@/contexts/app-context";
import { EmptyState } from "@/components/content/empty-state";

export function ObjectsView() {
  const { selectedBucket, setView, selectBucket } = useApp();

  return (
    <EmptyState
      icon={FolderOpen}
      title={selectedBucket ? `Browsing: ${selectedBucket}` : "No bucket selected"}
      description="Object browser coming soon. Select a bucket to view its contents."
      actionLabel="Back to Buckets"
      onAction={() => {
        selectBucket(null);
        setView("buckets");
      }}
    />
  );
}
