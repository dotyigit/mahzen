"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  Copy,
  FolderOpen,
  Moon,
  Plus,
  RefreshCcw,
  FolderSync,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useApp } from "@/contexts/app-context";

type CommandPaletteProps = {
  onNewTarget: () => void;
  onClone?: () => void;
};

export function CommandPalette({ onNewTarget, onClone }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { targets, selectTarget, setView, refreshAll } = useApp();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const runAndClose = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search targets, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {targets.length > 0 && (
          <CommandGroup heading="Targets">
            {targets.map((target) => (
              <CommandItem
                key={target.id}
                onSelect={() => runAndClose(() => selectTarget(target.id))}
              >
                <Archive className="mr-2 h-4 w-4" />
                {target.name}
                <span className="ml-auto truncate text-xs text-muted-foreground">{target.endpoint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAndClose(onNewTarget)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Target
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => void refreshAll())}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh All
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setView("buckets"))}>
            <FolderOpen className="mr-2 h-4 w-4" />
            View Buckets
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setView("sync-profiles"))}>
            <FolderSync className="mr-2 h-4 w-4" />
            View Sync Profiles
          </CommandItem>
          {onClone && (
            <CommandItem onSelect={() => runAndClose(onClone)}>
              <Copy className="mr-2 h-4 w-4" />
              Clone Bucket
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runAndClose(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />
            Light Mode
            {resolvedTheme === "light" && <span className="ml-auto text-xs text-muted-foreground">active</span>}
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />
            Dark Mode
            {resolvedTheme === "dark" && <span className="ml-auto text-xs text-muted-foreground">active</span>}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
