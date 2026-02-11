"use client";

import { useState } from "react";
import { Archive, FolderOpen, FolderSync, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApp } from "@/contexts/app-context";
import { useTransfers } from "@/contexts/transfer-context";
import { TargetList } from "@/components/sidebar/target-list";
import { SidebarFooterSection } from "@/components/sidebar/sidebar-footer";
import { TargetFormDialog } from "@/components/forms/target-form-dialog";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import type { StorageTarget } from "@/lib/types";

export function AppSidebar() {
  const app = useApp();
  const { queue, togglePanel } = useTransfers();

  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<StorageTarget | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const activeCount = queue.filter((i) => !["completed", "failed", "cancelled"].includes(i.status)).length;

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setTargetDialogOpen(true);
  };

  const handleOpenEdit = (target: StorageTarget) => {
    setEditingTarget(target);
    setTargetDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await app.deleteTarget(deleteTargetId);
    } catch {
      // error toast handled in context
    }
    setDeleteTargetId(null);
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <span className="text-base font-bold tracking-tight group-data-[collapsible=icon]:hidden">Mahzen</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Storage Targets</SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="h-[calc(100vh-360px)] min-h-[200px]">
                <TargetList
                  targets={app.targets}
                  selectedTargetId={app.selectedTargetId}
                  onSelect={app.selectTarget}
                  onEdit={handleOpenEdit}
                  onTest={(id) => void app.testConnection(id)}
                  onRefresh={() => void app.refreshBuckets()}
                  onDelete={setDeleteTargetId}
                />
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={app.view === "buckets"}
                    onClick={() => app.setView("buckets")}
                    tooltip="Buckets"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>Buckets</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={app.view === "sync-profiles"}
                    onClick={() => app.setView("sync-profiles")}
                    tooltip="Sync Profiles"
                  >
                    <FolderSync className="h-4 w-4" />
                    <span>Sync Profiles</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={togglePanel} tooltip="Transfers">
                    <ArrowUpDown className="h-4 w-4" />
                    <span>Transfers</span>
                    {activeCount > 0 && (
                      <Badge variant="secondary" className="ml-auto rounded-full px-1.5 py-0 text-[10px]">
                        {activeCount}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooterSection onAddTarget={handleOpenCreate} />
      </Sidebar>

      <TargetFormDialog
        open={targetDialogOpen}
        onOpenChange={setTargetDialogOpen}
        editTarget={editingTarget}
      />

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete this target?"
        description="This removes target configuration and stored credentials for this connection."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}
