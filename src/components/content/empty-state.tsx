"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50" />}
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground/70">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
