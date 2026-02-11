"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
};

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
      <span>
        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
