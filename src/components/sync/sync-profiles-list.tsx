"use client";

import { useState } from "react";
import { Plus, FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/app-context";
import { useTransfers } from "@/contexts/transfer-context";
import { nowEpoch } from "@/lib/format";
import { SyncProfileCard } from "@/components/sync/sync-profile-card";
import { SyncProfileFormDialog } from "@/components/sync/sync-profile-form-dialog";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { EmptyState } from "@/components/content/empty-state";
import type { SyncProfile } from "@/lib/types";

export function SyncProfilesList() {
  const { selectedTarget } = useApp();
  const { syncProfiles, upsertProfile, deleteProfiles } = useTransfers();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SyncProfile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);

  const filteredProfiles = selectedTarget
    ? syncProfiles.filter((p) => p.targetId === selectedTarget.id)
    : syncProfiles;

  const handleToggleEnabled = async (profile: SyncProfile, enabled: boolean) => {
    await upsertProfile({ ...profile, enabled, updatedAt: nowEpoch() });
  };

  const handleConfirmDelete = async () => {
    if (!deleteProfileId) return;
    try {
      await deleteProfiles([deleteProfileId]);
    } catch {
      // toast handled in context
    }
    setDeleteProfileId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sync Profiles</h2>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditingProfile(null);
            setFormOpen(true);
          }}
          disabled={!selectedTarget}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Profile
        </Button>
      </div>

      {filteredProfiles.length === 0 ? (
        <EmptyState
          icon={FolderSync}
          title="No sync profiles"
          description={
            selectedTarget
              ? "Create a sync profile to keep local files in sync with this target."
              : "Select a target to view its sync profiles."
          }
          actionLabel={selectedTarget ? "Add Profile" : undefined}
          onAction={
            selectedTarget
              ? () => {
                  setEditingProfile(null);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredProfiles.map((profile) => (
            <SyncProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => {
                setEditingProfile(profile);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteProfileId(profile.id)}
              onToggleEnabled={(enabled) => void handleToggleEnabled(profile, enabled)}
            />
          ))}
        </div>
      )}

      <SyncProfileFormDialog open={formOpen} onOpenChange={setFormOpen} editProfile={editingProfile} />

      <ConfirmDialog
        open={Boolean(deleteProfileId)}
        onOpenChange={(open) => !open && setDeleteProfileId(null)}
        title="Delete this sync profile?"
        description="This removes the sync profile configuration. No files will be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
