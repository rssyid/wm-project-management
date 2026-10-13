import { cn } from "cn";
import { addWeeks } from "date-fns";

import { formatDate, formatShortDate } from "@/shared/format";

import {
  GANTT_CURRENT_WEEK,
  GANTT_FIRST_MONDAY,
  type GanttCellKind,
  type GanttRow,
} from "./sample-data";

// docs/01 §11: baseline gray, first revision yellow, later revisions orange, revision cells striped.
const CELL_CLASS: Record<GanttCellKind, string> = {
  none: "",
  base: "bg-gantt-base",
  rev1: "bg-gantt-rev1 gantt-stripes",
  rev2: "bg-gantt-rev2 gantt-stripes",
};

const CELL_LABEL: Record<GanttCellKind, string> = {
  none: "tanpa rencana",
  base: "baseline",
  rev1: "tambahan revisi pertama",
  rev2: "tambahan revisi berikutnya",
};

const INDENT = ["pl-3", "pl-6", "pl-9"] as const;

export function GanttLegend() {
  return (
    <ul
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted"
      aria-label="Legenda Gantt"
    >
      {(["base", "rev1", "rev2"] as const).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("inline-block size-3 rounded-sm", CELL_CLASS[kind])}
          />
          {CELL_LABEL[kind].replace(/^./, (c) => c.toUpperCase())}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="font-semibold text-ink">
          #
        </span>
        Berjalan
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="font-semibold text-ink">
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
  const weekCount = rows[0]?.cells.length ?? 0;
  const firstMonday = new Date(`${GANTT_FIRST_MONDAY}T00:00:00+07:00`);
  const weeks = Array.from({ length: weekCount }, (_, index) =>
    addWeeks(firstMonday, index),
  );

  return (
    <div className="overflow-x-auto rounded-lg border bg-panel">
      <table className="border-separate border-spacing-0 text-dense">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-56 border-r border-b bg-surface px-3 py-2 text-left font-medium text-ink-muted md:min-w-72"
            >
              Proses
            </th>
            <th
              scope="col"
              className="hidden border-b px-3 py-2 text-right font-medium text-ink-muted md:table-cell"
            >
              Plan mulai
            </th>
            <th
              scope="col"
              className="hidden border-r border-b px-3 py-2 text-right font-medium text-ink-muted md:table-cell"
            >
              Plan selesai
            </th>
            {weeks.map((monday, index) => (
              <th
                key={monday.toISOString()}
                scope="col"
                className={cn(
                  "min-w-11 border-b px-1 py-2 text-center font-medium text-ink-muted",
                  index + 1 === GANTT_CURRENT_WEEK &&
                    "bg-canal-soft text-canal",
                )}
              >
                <span className="block">W{index + 1}</span>
                <span className="block text-xs font-normal tabular-nums">
                  {formatShortDate(monday)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 border-r border-b bg-panel py-2 pr-3 text-left align-top",
                  INDENT[row.depth],
                  row.depth === 0 ? "font-semibold" : "font-normal",
                )}
              >
                <span className="block text-ink">{row.name}</span>
                <span className="block text-xs text-ink-muted">
                  {row.status}
                </span>
              </th>
              <td className="hidden border-b px-3 py-2 text-right tabular-nums md:table-cell">
                {formatDate(new Date(row.planStart))}
              </td>
              <td className="hidden border-r border-b px-3 py-2 text-right tabular-nums md:table-cell">
                {formatDate(new Date(row.planEnd))}
              </td>
              {row.cells.map((cell, index) => {
                const symbolLabel =
                  cell.symbol === "#"
                    ? ", berjalan"
                    : cell.symbol === "✓"
                      ? ", selesai"
                      : "";
                return (
                  <td
                    key={index}
                    aria-label={`${row.name}, W${index + 1}: ${CELL_LABEL[cell.kind]}${symbolLabel}`}
                    className={cn(
                      "h-10 border-b p-0.5 text-center",
                      index + 1 === GANTT_CURRENT_WEEK && "bg-canal-soft/60",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-full items-center justify-center rounded-sm font-semibold text-ink",
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
  );
}
