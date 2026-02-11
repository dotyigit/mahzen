"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  isTauriRuntime,
  targetBucketsList,
  targetConnectionTest,
  targetCredentialsGet,
  targetCredentialsUpsert,
  targetsDelete,
  targetsList,
  targetsUpsert,
} from "@/lib/tauri";
import type { S3BucketSummary, StorageTarget, TargetCredentials } from "@/lib/types";

export type AppView = "buckets" | "objects" | "sync-profiles";

type AppContextValue = {
  targets: StorageTarget[];
  selectedTargetId: string | null;
  selectedTarget: StorageTarget | null;
  selectedBucket: string | null;
  buckets: S3BucketSummary[];
  view: AppView;
  isLoading: boolean;
  isBucketLoading: boolean;
  bucketError: string | null;
  runtimeError: string | null;
  selectTarget: (id: string) => void;
  selectBucket: (name: string | null) => void;
  setView: (view: AppView) => void;
  refreshAll: () => Promise<void>;
  refreshBuckets: () => Promise<void>;
  testConnection: (targetId: string) => Promise<void>;
  createTarget: (target: StorageTarget, credentials: TargetCredentials) => Promise<void>;
  updateTarget: (target: StorageTarget, credentials: TargetCredentials) => Promise<void>;
  deleteTarget: (id: string) => Promise<void>;
  getTargetCredentials: (targetId: string) => Promise<TargetCredentials | null>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<S3BucketSummary[]>([]);
  const [view, setView] = useState<AppView>("buckets");
  const [isLoading, setIsLoading] = useState(false);
  const [isBucketLoading, setIsBucketLoading] = useState(false);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const selectedTarget = useMemo(
    () => targets.find((t) => t.id === selectedTargetId) ?? targets[0] ?? null,
    [targets, selectedTargetId],
  );

  const effectiveTargetId = selectedTarget?.id ?? null;

  const loadBuckets = useCallback(async (targetId: string) => {
    if (!isTauriRuntime()) return;
    setIsBucketLoading(true);
    setBucketError(null);
    try {
      const result = await targetBucketsList(targetId);
      setBuckets(result);
    } catch (err) {
      setBucketError(err instanceof Error ? err.message : "Failed to load buckets.");
      setBuckets([]);
    } finally {
      setIsBucketLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!isTauriRuntime()) {
      setRuntimeError("Run with `npm run tauri:dev` to enable native commands.");
      return;
    }
    setRuntimeError(null);
    setIsLoading(true);
    try {
      const nextTargets = await targetsList();
      setTargets(nextTargets);
      const activeId =
        selectedTargetId && nextTargets.some((t) => t.id === selectedTargetId)
          ? selectedTargetId
          : nextTargets[0]?.id ?? null;
      setSelectedTargetId(activeId);
      if (activeId) await loadBuckets(activeId);
      else setBuckets([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load state.";
      setRuntimeError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [loadBuckets, selectedTargetId]);

  const refreshBuckets = useCallback(async () => {
    if (effectiveTargetId) await loadBuckets(effectiveTargetId);
  }, [effectiveTargetId, loadBuckets]);

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (effectiveTargetId) void loadBuckets(effectiveTargetId);
  }, [effectiveTargetId, loadBuckets]);

  const selectTarget = useCallback((id: string) => {
    setSelectedTargetId(id);
    setSelectedBucket(null);
    setView("buckets");
  }, []);

  const selectBucket = useCallback((name: string | null) => {
    setSelectedBucket(name);
    if (name) setView("objects");
  }, []);

  const testConnection = useCallback(
    async (targetId: string) => {
      try {
        const result = await targetConnectionTest(targetId);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
        await loadBuckets(targetId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Connection test failed");
      }
    },
    [loadBuckets],
  );

  const createTarget = useCallback(
    async (target: StorageTarget, credentials: TargetCredentials) => {
      await targetsUpsert(target);
      await targetCredentialsUpsert(target.id, credentials);
      await refreshAll();
      toast.success("Target created");
    },
    [refreshAll],
  );

  const updateTarget = useCallback(
    async (target: StorageTarget, credentials: TargetCredentials) => {
      await targetsUpsert(target);
      await targetCredentialsUpsert(target.id, credentials);
      await refreshAll();
      toast.success("Target updated");
    },
    [refreshAll],
  );

  const deleteTarget = useCallback(
    async (id: string) => {
      await targetsDelete([id]);
      await refreshAll();
      toast.success("Target deleted");
    },
    [refreshAll],
  );

  const getTargetCredentials = useCallback(async (targetId: string) => {
    return targetCredentialsGet(targetId);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      targets,
      selectedTargetId: effectiveTargetId,
      selectedTarget,
      selectedBucket,
      buckets,
      view,
      isLoading,
      isBucketLoading,
      bucketError,
      runtimeError,
      selectTarget,
      selectBucket,
      setView,
      refreshAll,
      refreshBuckets,
      testConnection,
      createTarget,
      updateTarget,
      deleteTarget,
      getTargetCredentials,
    }),
    [
      targets,
      effectiveTargetId,
      selectedTarget,
      selectedBucket,
      buckets,
      view,
      isLoading,
      isBucketLoading,
      bucketError,
      runtimeError,
      selectTarget,
      selectBucket,
      refreshAll,
      refreshBuckets,
      testConnection,
      createTarget,
      updateTarget,
      deleteTarget,
      getTargetCredentials,
    ],
  );

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
