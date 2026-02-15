"use client";

import { useCallback, useMemo } from "react";
import { ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTransfers } from "@/contexts/transfer-context";
import { TransferTable } from "@/components/transfers/transfer-table";
import { CloneJobTable, type CloneActions } from "@/components/clone/clone-job-table";
import {
  clonePause,
  cloneResume,
  cloneCancel,
  cloneJobDelete,
  cloneRetryFailed,
} from "@/lib/tauri";

export function TransferPanel() {
  const { queue, cloneJobs, aggregateProgress, isPanelOpen, togglePanel, clearFinished, refreshCloneJobs } = useTransfers();

  const activeCount = queue.filter((i) => !["completed", "failed", "cancelled"].includes(i.status)).length;
  const finishedCount = queue.length - activeCount;

  const activeClones = cloneJobs.filter((j) => ["running", "enumerating"].includes(j.status)).length;
  const totalClones = cloneJobs.length;

  const cloneActions: CloneActions = useMemo(() => ({
    onPause: async (jobId) => {
      await clonePause(jobId);
      await refreshCloneJobs();
    },
    onResume: async (jobId) => {
      await cloneResume(jobId);
      await refreshCloneJobs();
      toast.success("Clone job resumed");
    },
    onCancel: async (jobId) => {
      await cloneCancel(jobId);
      await refreshCloneJobs();
      toast.success("Clone job cancelled");
    },
    onDelete: async (jobId) => {
      await cloneJobDelete(jobId);
      await refreshCloneJobs();
      toast.success("Clone job deleted");
    },
    onRetryFailed: async (jobId) => {
      await cloneRetryFailed(jobId);
      await refreshCloneJobs();
      toast.success("Retrying failed items");
    },
  }), [refreshCloneJobs]);

  return (
    <Collapsible open={isPanelOpen} onOpenChange={togglePanel}>
      <div className="border-t bg-background">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-3 px-4 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors">
            <ChevronUp
              className={`h-3.5 w-3.5 transition-transform ${isPanelOpen ? "rotate-180" : ""}`}
            />
            <span className="font-medium">
              Transfers: {activeCount} active, {finishedCount} finished
              {totalClones > 0 && (
                <> &middot; Clones: {activeClones} active, {totalClones} total</>
              )}
            </span>
            <Progress value={aggregateProgress} className="ml-2 h-1.5 w-24" />
            <span>{aggregateProgress}%</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">Cmd+J</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-3">
            <Tabs defaultValue="transfers">
              <div className="mb-3 flex items-center justify-between">
                <TabsList className="h-7">
                  <TabsTrigger value="transfers" className="text-xs px-3 py-1">
                    Transfers
                  </TabsTrigger>
                  <TabsTrigger value="clones" className="text-xs px-3 py-1">
                    Clone Jobs{totalClones > 0 && ` (${totalClones})`}
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void clearFinished()}
                  disabled={finishedCount === 0}
                >
                  <Trash2 className="h-3 w-3" />
                  Clear Finished
                </Button>
              </div>
              <TabsContent value="transfers" className="mt-0">
                <TransferTable />
              </TabsContent>
              <TabsContent value="clones" className="mt-0">
                <CloneJobTable jobs={cloneJobs} actions={cloneActions} />
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
