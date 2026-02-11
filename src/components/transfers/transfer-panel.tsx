"use client";

import { ChevronUp, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTransfers } from "@/contexts/transfer-context";
import { TransferTable } from "@/components/transfers/transfer-table";

export function TransferPanel() {
  const { queue, aggregateProgress, isPanelOpen, togglePanel, clearFinished } = useTransfers();

  const activeCount = queue.filter((i) => !["completed", "failed", "cancelled"].includes(i.status)).length;
  const finishedCount = queue.length - activeCount;

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
            </span>
            <Progress value={aggregateProgress} className="ml-2 h-1.5 w-24" />
            <span>{aggregateProgress}%</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">Cmd+J</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Transfer Queue</p>
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
            <TransferTable />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
