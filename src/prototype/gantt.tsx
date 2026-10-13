import { cn } from "cn";
import { addWeeks } from "date-fns";

import { formatGanttDate, formatGanttWeek } from "@/shared/format";

import {
  GANTT_CURRENT_WEEK,
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
  const weekCount = rows[0]?.cells.length ?? 0;
  const firstMonday = new Date(`${GANTT_FIRST_MONDAY}T00:00:00+07:00`);
  const weeks = Array.from({ length: weekCount }, (_, index) =>
    addWeeks(firstMonday, index),
  );

  // D-28: batas kanan minggu berjalan ditandai garis merah penuh dari header sampai baris
  // terakhir. `border-r-ews-red` wajib, bukan `border-ews-red`: yang terakhir memberi warna
  // ke keempat sisi sehingga garis bawah sel ikut merah dan muncul sebagai garis horizontal.
  const weekEdge = (index: number) =>
    index + 1 === GANTT_CURRENT_WEEK
      ? "border-r-[3px] border-r-ews-red"
      : "border-r border-line";

  return (
    <div>
      {/* WCAG 2.1.1: wadah yang bisa digeser harus bisa difokus, kalau tidak keyboard user
          tidak bisa menjelajah kolom minggu di layar kecil. */}
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
                className="sticky left-0 z-10 min-w-56 border-r border-b border-line bg-surface px-3 py-2 text-left font-medium text-ink-muted md:min-w-72"
              >
                Proses
              </th>
              <th
                scope="col"
                className="hidden border-b border-line px-3 py-2 text-right font-medium text-ink-muted md:table-cell"
              >
                Plan mulai
              </th>
              <th
                scope="col"
                className="hidden border-b border-line px-3 py-2 text-right font-medium text-ink-muted md:table-cell"
              >
                Plan selesai
              </th>
              {weeks.map((monday, index) => (
                <th
                  key={monday.toISOString()}
                  scope="col"
                  className={cn(
                    "min-w-11 border-b border-line px-1 py-1.5 text-center leading-tight font-medium text-ink-muted",
                    weekEdge(index),
                  )}
                >
                  <span className="block leading-tight">W{index + 1}</span>
                  <span className="block text-xs leading-tight font-normal tabular-nums">
                    {formatGanttWeek(monday)}
                  </span>
                  {index + 1 === GANTT_CURRENT_WEEK ? (
                    <span className="sr-only">, minggu berjalan</span>
                  ) : null}
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
                    "sticky left-0 z-10 border-r border-b border-line bg-panel py-1 pr-3 text-left align-middle leading-tight",
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
                <td className="hidden border-b border-line px-3 py-1 text-right tabular-nums md:table-cell">
                  {formatGanttDate(new Date(row.planStart))}
                </td>
                <td className="hidden border-r border-b border-line px-3 py-1 text-right tabular-nums md:table-cell">
                  {formatGanttDate(new Date(row.planEnd))}
                </td>
                {row.cells.map((cell, index) => {
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
                        weekEdge(index),
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
