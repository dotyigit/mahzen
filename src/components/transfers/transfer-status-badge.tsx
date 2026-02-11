"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

export function TransferStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-md border-none text-[11px] px-1.5 py-0", statusStyles[status])}>
      {status}
    </Badge>
  );
}
