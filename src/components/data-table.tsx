"use client";

import {
  createCoreRowModel,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "cn";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Rule 35 §6: numeric columns are right-aligned and tabular.
type DataTableColumnMeta = { align?: "left" | "right" };

export const dataTableFeatures = tableFeatures({
  coreRowModel: createCoreRowModel(),
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableColumn<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData>;

type DataTableProps<TData extends RowData> = {
  columns: ReadonlyArray<DataTableColumn<TData>>;
  data: ReadonlyArray<TData>;
  getRowId: (row: TData) => string;
  /** D-20: below 768 px each row becomes a compact list item (name, status, main figure). */
  renderMobileRow: (row: TData) => ReactNode;
  empty: ReactNode;
  caption: string;
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  renderMobileRow,
  empty,
  caption,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => getRowId(row),
  });

  if (data.length === 0) {
    return <div className="rounded-lg border bg-panel">{empty}</div>;
  }

  return (
    <div className="rounded-lg border bg-panel">
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    scope="col"
                    className={cn(
                      header.column.columnDef.meta?.align === "right" && "text-right",
                    )}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums",
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={caption}>
        {data.map((row) => (
          <li key={getRowId(row)} className="px-4 py-3">
            {renderMobileRow(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
