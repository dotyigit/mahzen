"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  isTauriRuntime,
  syncProfilesDelete,
  syncProfilesList,
  syncProfilesUpsert,
  transferQueueClearTerminal,
  transferQueueDelete,
  transferQueueList,
  transferQueueUpsert,
} from "@/lib/tauri";
import type { SyncProfile, TransferQueueItem } from "@/lib/types";

type TransferContextValue = {
  queue: TransferQueueItem[];
  syncProfiles: SyncProfile[];
  aggregateProgress: number;
  isPanelOpen: boolean;
  refreshQueue: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  upsertTransfer: (item: TransferQueueItem) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  upsertProfile: (profile: SyncProfile) => Promise<void>;
  deleteProfiles: (ids: string[]) => Promise<void>;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
};

const TransferContext = createContext<TransferContextValue | null>(null);

export function TransferProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<TransferQueueItem[]>([]);
  const [syncProfiles, setSyncProfiles] = useState<SyncProfile[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const aggregateProgress = useMemo(() => {
    const active = queue.filter((i) => !["completed", "failed", "cancelled"].includes(i.status));
    if (!active.length) return 0;
    const total = active.reduce((s, i) => s + (i.totalBytes ?? 0), 0);
    if (total <= 0) return 0;
    const done = active.reduce((s, i) => s + (i.transferredBytes ?? 0), 0);
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }, [queue]);

  const refreshQueue = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      setQueue(await transferQueueList());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load transfer queue");
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      setSyncProfiles(await syncProfilesList());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sync profiles");
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    void refreshProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertTransfer = useCallback(
    async (item: TransferQueueItem) => {
      await transferQueueUpsert(item);
      await refreshQueue();
    },
    [refreshQueue],
  );

  const deleteTransfer = useCallback(
    async (id: string) => {
      await transferQueueDelete(id);
      await refreshQueue();
      toast.success("Transfer removed");
    },
    [refreshQueue],
  );

  const clearFinished = useCallback(async () => {
    if (!isTauriRuntime()) return;
    await transferQueueClearTerminal();
    await refreshQueue();
    toast.success("Finished transfers cleared");
  }, [refreshQueue]);

  const upsertProfile = useCallback(
    async (profile: SyncProfile) => {
      await syncProfilesUpsert(profile);
      await refreshProfiles();
      toast.success("Sync profile saved");
    },
    [refreshProfiles],
  );

  const deleteProfiles = useCallback(
    async (ids: string[]) => {
      await syncProfilesDelete(ids);
      await refreshProfiles();
      toast.success("Sync profile deleted");
    },
    [refreshProfiles],
  );

  const togglePanel = useCallback(() => setIsPanelOpen((p) => !p), []);
  const setPanelOpen = useCallback((open: boolean) => setIsPanelOpen(open), []);

  const value = useMemo<TransferContextValue>(
    () => ({
      queue,
      syncProfiles,
      aggregateProgress,
      isPanelOpen,
      refreshQueue,
      refreshProfiles,
      upsertTransfer,
      deleteTransfer,
      clearFinished,
      upsertProfile,
      deleteProfiles,
      togglePanel,
      setPanelOpen,
    }),
    [
      queue,
      syncProfiles,
      aggregateProgress,
      isPanelOpen,
      refreshQueue,
      refreshProfiles,
      upsertTransfer,
      deleteTransfer,
      clearFinished,
      upsertProfile,
      deleteProfiles,
      togglePanel,
      setPanelOpen,
    ],
  );

  return <TransferContext value={value}>{children}</TransferContext>;
}

export function useTransfers() {
  const ctx = useContext(TransferContext);
  if (!ctx) throw new Error("useTransfers must be used within TransferProvider");
  return ctx;
}
