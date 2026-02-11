"use client";

import { FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { S3BucketSummary } from "@/lib/types";

type BucketCardProps = {
  bucket: S3BucketSummary;
  onClick: () => void;
};

export function BucketCard({ bucket, onClick }: BucketCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{bucket.name}</p>
          <p className="text-xs text-muted-foreground">Created {formatDate(bucket.createdAt)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
