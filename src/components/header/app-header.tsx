"use client";

import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbNav } from "@/components/header/breadcrumb-nav";
import { useApp } from "@/contexts/app-context";

export function AppHeader() {
  const { refreshAll, isLoading } = useApp();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <BreadcrumbNav />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => void refreshAll()}
          disabled={isLoading}
        >
          <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span className="sr-only">Refresh</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            // Trigger command palette via keyboard event
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
      </div>
    </header>
  );
}
