"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarFooter as ShadcnSidebarFooter } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

type SidebarFooterProps = {
  onAddTarget: () => void;
};

export function SidebarFooterSection({ onAddTarget }: SidebarFooterProps) {
  return (
    <ShadcnSidebarFooter>
      <div className="flex items-center justify-between px-2">
        <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={onAddTarget}>
          <Plus className="h-3.5 w-3.5" />
          Add Target
        </Button>
        <ThemeToggle />
      </div>
    </ShadcnSidebarFooter>
  );
}
