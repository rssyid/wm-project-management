"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatPercent } from "@/shared/format";

type DeviationRow = {
  projectCode: string;
  projectName: string;
  deviationPct: number;
};

export function DeviationsTable({
  deviations,
}: {
  deviations: DeviationRow[];
}) {
  if (deviations.length === 0) {
    return (
      <div className="rounded-sm border border-line bg-panel p-6 text-center text-sm text-ink-muted">
        Tidak ada deviasi yang mencolok.
      </div>
    );
  }

  return (
    <section className="mb-6 overflow-hidden rounded-sm border border-line bg-panel">
      <h2 className="mb-0 border-b border-line p-4 text-base font-semibold">
        10 Deviasi Terbesar
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Proyek</TableHead>
            <TableHead className="w-1/3">Nama Proyek</TableHead>
            <TableHead className="w-1/3 text-right">Deviasi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deviations.map((row) => (
            <TableRow key={row.projectCode} className="border-b border-line">
              <TableCell className="p-3 text-sm">{row.projectCode}</TableCell>
              <TableCell className="p-3 text-sm">{row.projectName}</TableCell>
              <TableCell className="p-3 text-right text-sm tabular-nums">
                {formatPercent(row.deviationPct.toString())}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
