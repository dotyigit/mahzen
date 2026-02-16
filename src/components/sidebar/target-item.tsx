"use client";

import { Pencil, RefreshCcw, Trash2, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { StorageTarget } from "@/lib/types";

type TargetItemProps = {
  target: StorageTarget;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onTest: () => void;
  onRefresh: () => void;
  onDelete: () => void;
};

export function TargetItem({ target, isSelected, onSelect, onEdit, onTest, onRefresh, onDelete }: TargetItemProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <SidebarMenuButton
          isActive={isSelected}
          onClick={onSelect}
          className="h-auto flex-col items-start gap-0.5 px-3 py-2"
          tooltip={target.endpoint}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{target.name}</span>
            <div className="flex items-center gap-1">
              {target.scopedBucket && (
                <Badge variant="outline" className="shrink-0 rounded-md border-sky-300 bg-sky-500/10 text-sky-700 dark:border-sky-700 dark:text-sky-400 text-[10px] px-1.5 py-0">
                  {target.scopedBucket}
                </Badge>
              )}
              {target.hasCredentials ? (
                <Badge variant="outline" className="shrink-0 rounded-md border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                  ready
                </Badge>
              ) : (
                <Badge variant="destructive" className="shrink-0 rounded-md text-[10px] px-1.5 py-0">
                  no keys
                </Badge>
              )}
            </div>
          </div>
          <span className="w-full truncate text-xs text-muted-foreground">{target.endpoint}</span>
          {target.pinnedBuckets.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {target.pinnedBuckets.slice(0, 3).map((b) => (
                <Badge key={b} variant="outline" className="rounded-md text-[10px] px-1 py-0">
                  {b}
                </Badge>
              ))}
            </div>
          )}
        </SidebarMenuButton>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Target
        </ContextMenuItem>
        <ContextMenuItem onClick={onTest}>
          <Wifi className="mr-2 h-4 w-4" />
          Test Connection
        </ContextMenuItem>
        <ContextMenuItem onClick={onRefresh}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh Buckets
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Target
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
