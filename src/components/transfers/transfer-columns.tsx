"use client";

import { ArrowDownToLine, ArrowUpToLine, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { TransferStatusBadge } from "@/components/transfers/transfer-status-badge";
import { formatBytes } from "@/lib/format";
import type { TransferQueueItem } from "@/lib/types";

export function getTransferColumns(onDelete: (id: string) => void): ColumnDef<TransferQueueItem>[] {
  return [
    {
      accessorKey: "key",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Object Key" />,
      cell: ({ row }) => (
        <span className="max-w-[300px] truncate font-mono text-xs">{row.getValue("key")}</span>
      ),
    },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) => {
        const dir = row.getValue("direction") as string;
        return dir === "upload" ? (
          <Badge variant="outline" className="gap-1 rounded-md text-[11px]">
            <ArrowUpToLine className="h-3 w-3" />
            upload
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 rounded-md text-[11px]">
            <ArrowDownToLine className="h-3 w-3" />
            download
          </Badge>
        );
      },
      filterFn: "equals",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <TransferStatusBadge status={row.getValue("status")} />,
      filterFn: "equals",
    },
    {
      accessorKey: "totalBytes",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Size" className="justify-end" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatBytes(row.getValue("totalBytes"))}</span>
      ),
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const total = row.original.totalBytes ?? 0;
        const transferred = row.original.transferredBytes ?? 0;
        const pct = total > 0 ? Math.round((transferred / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-1.5 w-16" />
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDelete(row.original.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];
}
