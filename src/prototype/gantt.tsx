"use client";

import { cn } from "cn";
import { addWeeks } from "date-fns";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { formatGanttDate, formatGanttWeek } from "@/shared/format";

import { currentWeekIndex, outlineNumbers } from "./gantt-model";
import {
  GANTT_FIRST_MONDAY,
  type GanttCellKind,
  type GanttRow,
} from "./sample-data";

// docs/01 §11: baseline abu-abu, tambahan revisi pertama kuning, tambahan berikutnya oranye.
// D-27: sel revisi solid, tanpa pola garis.
const CELL_CLASS: Record<GanttCellKind, string> = {
  none: "",
  base: "bg-gantt-base",
  rev1: "bg-gantt-rev1",
  rev2: "bg-gantt-rev2",
};

const CELL_LABEL: Record<GanttCellKind, string> = {
  none: "tanpa rencana",
  base: "rencana",
  rev1: "target revisi",
  rev2: "revisi",
};

const INDENT = ["pl-3", "pl-6", "pl-9"] as const;
const RANGE_OPTIONS = [8, 16, 26, 52] as const;
const NO_COLUMN_WIDTH = "w-10";

const subscribeToNothing = () => () => {};

// D-32: minggu berjalan hanya diketahui di browser. `cacheComponents` Next 16 menolak
// `Date.now()` saat prerender, jadi server snapshot-nya null dan tabel ter-render tanpa
// garis merah; browser mengisinya setelah hidrasi.
const weekSnapshot = () => currentWeekIndex(GANTT_FIRST_MONDAY);
const serverWeekSnapshot = () => null;

function GanttLegend() {
  return (
    <ul
      className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted"
      aria-label="Legenda Gantt"
    >
      {(
        [
          ["base", "Rencana"],
          ["rev1", "Target revisi"],
          ["rev2", "Revisi minggu ini"],
        ] as const
      ).map(([kind, label]) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("inline-block size-3.5 rounded-sm", CELL_CLASS[kind])}
          />
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 items-center justify-center rounded-sm border font-semibold text-ink"
        >
          #
        </span>
        Progres
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 items-center justify-center rounded-sm border font-semibold text-ink"
        >
          ✓
        </span>
        Selesai
      </li>
    </ul>
  );
}

export function GanttMatrix({
  rows,
  caption,
}: {
  rows: readonly GanttRow[];
  caption: string;
}) {
  const [weeks, setWeeks] = useState<number>(16);
  const currentWeek = useSyncExternalStore(
    subscribeToNothing,
    weekSnapshot,
    serverWeekSnapshot,
  );

  const numbers = useMemo(
    () => outlineNumbers(rows.map((row) => row.depth)),
    [rows],
  );

  const firstMonday = new Date(`${GANTT_FIRST_MONDAY}T00:00:00+07:00`);
  const shown = Array.from({ length: weeks }, (_, index) =>
    addWeeks(firstMonday, index),
  );

  // Garis merah hanya tampil bila minggu berjalan masuk rentang aktif.
  const showEdge = currentWeek !== null && currentWeek <= weeks;
  const isEdge = (index: number) => showEdge && index + 1 === currentWeek;

  // D-28: `border-r-ews-red` wajib, bukan `border-ews-red`; yang terakhir memberi warna
  // keempat sisi sehingga garis bawah tiap sel ikut merah dan muncul sebagai garis horizontal.
  const edgeClass = (index: number) =>
    isEdge(index) ? "border-r-[3px] border-r-ews-red" : "border-r border-line";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-dense text-ink-muted">Rentang</span>
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option === weeks ? "default" : "outline"}
            onClick={() => setWeeks(option)}
          >
            {option} minggu
          </Button>
        ))}
      </div>

      {/* WCAG 2.1.1: wadah yang bisa digeser harus bisa difokus. */}
      <div
        className="overflow-x-auto rounded-lg border bg-panel"
        tabIndex={0}
        role="group"
        aria-label={caption}
      >
        <table className="border-separate border-spacing-0 text-dense">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface">
            <tr>
              <th
                scope="col"
                rowSpan={3}
                className={cn(
                  "sticky left-0 z-10 border-r border-b border-line bg-surface px-1 text-center font-medium text-ink-muted",
                  NO_COLUMN_WIDTH,
                )}
              >
                No.
              </th>
              <th
                scope="col"
                rowSpan={3}
                className="sticky left-10 z-10 min-w-56 border-r border-b border-line bg-surface px-3 text-left font-medium text-ink-muted md:min-w-72"
              >
                Job Item
              </th>
              <th
                scope="colgroup"
                colSpan={2}
                className="hidden border-b border-line px-3 py-1.5 text-center font-medium text-ink-muted md:table-cell"
              >
                Plan
              </th>
              {showEdge && currentWeek !== null ? (
                <>
                  <th
                    scope="colgroup"
                    colSpan={currentWeek}
                    className={cn(
                      "border-b border-line px-3 py-1.5 text-center font-medium text-ink-muted",
                      edgeClass(currentWeek - 1),
                    )}
                  >
                    Timeline
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={weeks - currentWeek}
                    className="border-b border-line px-3 py-1.5"
                  />
                </>
              ) : (
                <th
                  scope="colgroup"
                  colSpan={weeks}
                  className="border-b border-line px-3 py-1.5 text-center font-medium text-ink-muted"
                >
                  Timeline
                </th>
              )}
            </tr>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className="hidden border-b border-line px-3 text-center font-medium text-ink-muted md:table-cell"
              >
                Start
              </th>
              <th
                scope="col"
                rowSpan={2}
                className="hidden border-b border-line px-3 text-center font-medium text-ink-muted md:table-cell"
              >
                End
              </th>
              {shown.map((monday, index) => (
                <th
                  key={monday.toISOString()}
                  scope="col"
                  className={cn(
                    "min-w-11 border-b border-line px-1 py-1 text-center leading-tight font-medium text-ink-muted",
                    edgeClass(index),
                  )}
                >
                  W{index + 1}
                </th>
              ))}
            </tr>
            <tr>
              {shown.map((monday, index) => (
                <th
                  key={monday.toISOString()}
                  scope="col"
                  aria-label={`W${index + 1}, ${formatGanttWeek(monday)}${isEdge(index) ? ", minggu berjalan" : ""}`}
                  className={cn(
                    "min-w-11 border-b border-line px-1 py-1 text-center text-xs leading-tight font-normal text-ink-muted tabular-nums",
                    edgeClass(index),
                  )}
                >
                  {formatGanttWeek(monday)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r border-b border-line bg-panel text-center align-middle",
                    NO_COLUMN_WIDTH,
                  )}
                >
                  {numbers[rowIndex]}
                </td>
                <th
                  scope="row"
                  className={cn(
                    "sticky left-10 z-10 border-r border-b border-line bg-panel py-1 pr-3 text-left align-middle leading-tight",
                    INDENT[row.depth],
                    row.depth === 0 ? "font-semibold" : "font-normal",
                  )}
                >
                  <span className="block leading-tight text-ink">
                    {row.name}
                  </span>
                  <span className="block text-xs leading-tight text-ink-muted">
                    {row.status}
                  </span>
                </th>
                <td className="hidden border-b border-line px-3 py-1 text-center tabular-nums md:table-cell">
                  {formatGanttDate(new Date(row.planStart))}
                </td>
                <td className="hidden border-b border-line px-3 py-1 text-center tabular-nums md:table-cell">
                  {formatGanttDate(new Date(row.planEnd))}
                </td>
                {row.cells.slice(0, weeks).map((cell, index) => {
                  const symbolLabel =
                    cell.symbol === "#"
                      ? ", progres"
                      : cell.symbol === "✓"
                        ? ", selesai"
                        : "";
                  return (
                    <td
                      key={index}
                      aria-label={`${row.name}, W${index + 1}: ${CELL_LABEL[cell.kind]}${symbolLabel}`}
                      className={cn(
                        "h-8 border-b border-line p-0 text-center",
                        edgeClass(index),
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-full w-full items-center justify-center font-semibold text-ink",
                          CELL_CLASS[cell.kind],
                        )}
                      >
                        {cell.symbol}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GanttLegend />
    </div>
  );
}
