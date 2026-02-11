"use client";

import { useMemo } from "react";
import { useTransfers } from "@/contexts/transfer-context";
import { DataTable } from "@/components/shared/data-table";
import { getTransferColumns } from "@/components/transfers/transfer-columns";

export function TransferTable() {
  const { queue, deleteTransfer } = useTransfers();

  const columns = useMemo(() => getTransferColumns((id) => void deleteTransfer(id)), [deleteTransfer]);

  return <DataTable columns={columns} data={queue} pageSize={10} />;
}
