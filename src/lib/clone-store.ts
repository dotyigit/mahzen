"use client";

import { useSyncExternalStore } from "react";
import type { CloneProgressEvent } from "@/lib/types";

export interface CloneJobProgress {
  jobId: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  totalBytes: number;
  transferredBytes: number;
  currentKey: string | null;
  speed: number;
  eta: number | null;
  _lastUpdate: number;
}

type Listener = () => void;

let jobs = new Map<string, CloneJobProgress>();
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

let initialized = false;
function initListeners() {
  if (initialized) return;
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  initialized = true;

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<CloneProgressEvent>("clone-progress", (event) => {
      const p = event.payload;
      const existing = jobs.get(p.jobId);
      const now = Date.now();

      const byteDelta = p.transferredBytes - (existing?.transferredBytes ?? 0);
      const timeDelta = existing ? (now - existing._lastUpdate) / 1000 : 1;
      const speed = timeDelta > 0 ? byteDelta / timeDelta : 0;

      const remaining = p.totalBytes - p.transferredBytes;
      const eta = speed > 0 ? remaining / speed : null;

      jobs = new Map(jobs);
      jobs.set(p.jobId, {
        ...p,
        speed,
        eta,
        _lastUpdate: now,
      });
      emit();
    });

    listen<{ jobId: string; status: string }>("clone-status-change", (event) => {
      const { jobId, status } = event.payload;
      jobs = new Map(jobs);
      const existing = jobs.get(jobId);
      if (existing) {
        jobs.set(jobId, { ...existing, status });
      } else {
        jobs.set(jobId, {
          jobId,
          status,
          totalItems: 0,
          completedItems: 0,
          failedItems: 0,
          skippedItems: 0,
          totalBytes: 0,
          transferredBytes: 0,
          currentKey: null,
          speed: 0,
          eta: null,
          _lastUpdate: Date.now(),
        });
      }
      emit();
    });
  });
}

export const cloneStore = {
  getSnapshot: () => jobs,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    initListeners();
    return () => {
      listeners.delete(listener);
    };
  },
  remove: (jobId: string) => {
    jobs = new Map(jobs);
    jobs.delete(jobId);
    emit();
  },
};

export function useCloneJobs(): Map<string, CloneJobProgress> {
  return useSyncExternalStore(
    cloneStore.subscribe,
    cloneStore.getSnapshot,
    cloneStore.getSnapshot,
  );
}
