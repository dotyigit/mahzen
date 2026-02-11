"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppProvider, useApp } from "@/contexts/app-context";
import { TransferProvider, useTransfers } from "@/contexts/transfer-context";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { AppHeader } from "@/components/header/app-header";
import { BucketsView } from "@/components/content/buckets-view";
import { ObjectsView } from "@/components/content/objects-view";
import { SyncProfilesList } from "@/components/sync/sync-profiles-list";
import { TransferPanel } from "@/components/transfers/transfer-panel";
import { CommandPalette } from "@/components/command/command-palette";
import { TargetFormDialog } from "@/components/forms/target-form-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function AppContent() {
  const { view, runtimeError, refreshAll } = useApp();
  const { togglePanel } = useTransfers();

  const [cmdTargetOpen, setCmdTargetOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            setCmdTargetOpen(true);
            break;
          case "r":
            e.preventDefault();
            void refreshAll();
            break;
          case "j":
            e.preventDefault();
            togglePanel();
            break;
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [refreshAll, togglePanel]);

  if (runtimeError) {
    return (
      <>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 items-center justify-center p-8">
            <Card className="max-w-md border-destructive/30 bg-destructive/5">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm font-medium text-destructive">{runtimeError}</p>
                <Button variant="outline" onClick={() => void refreshAll()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </>
    );
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 overflow-auto p-4">
          {view === "buckets" && <BucketsView />}
          {view === "objects" && <ObjectsView />}
          {view === "sync-profiles" && <SyncProfilesList />}
        </main>
        <TransferPanel />
      </SidebarInset>

      <CommandPalette onNewTarget={() => setCmdTargetOpen(true)} />
      <TargetFormDialog open={cmdTargetOpen} onOpenChange={setCmdTargetOpen} editTarget={null} />
    </>
  );
}

export function AppShell() {
  return (
    <AppProvider>
      <TransferProvider>
        <SidebarProvider>
          <AppContent />
        </SidebarProvider>
      </TransferProvider>
    </AppProvider>
  );
}
