"use client";

import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { TargetItem } from "@/components/sidebar/target-item";
import type { StorageTarget } from "@/lib/types";

type TargetListProps = {
  targets: StorageTarget[];
  selectedTargetId: string | null;
  onSelect: (id: string) => void;
  onEdit: (target: StorageTarget) => void;
  onTest: (targetId: string) => void;
  onRefresh: (targetId: string) => void;
  onDelete: (targetId: string) => void;
};

export function TargetList({ targets, selectedTargetId, onSelect, onEdit, onTest, onRefresh, onDelete }: TargetListProps) {
  if (targets.length === 0) {
    return (
      <div className="px-3 py-4">
        <p className="text-xs text-muted-foreground">No targets yet. Add your first storage target.</p>
      </div>
    );
  }

  return (
    <SidebarMenu>
      {targets.map((target) => (
        <SidebarMenuItem key={target.id}>
          <TargetItem
            target={target}
            isSelected={selectedTargetId === target.id}
            onSelect={() => onSelect(target.id)}
            onEdit={() => onEdit(target)}
            onTest={() => onTest(target.id)}
            onRefresh={() => onRefresh(target.id)}
            onDelete={() => onDelete(target.id)}
          />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
