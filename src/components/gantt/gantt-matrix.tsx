"use client";

import { useState } from "react";

import { GanttProjectData } from "@/domain/gantt/queries";
import { formatGanttDate, formatGanttWeek } from "@/shared/format";

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 56;
// Mobile-first: identitas lebih sempit di layar kecil.
const IDENTITY_WIDTH = 160;
const WEEK_COL_WIDTH = 48;

type GanttMatrixProps = {
  data: GanttProjectData;
};

export function GanttMatrix({ data }: GanttMatrixProps) {
  const [weekCount, setWeekCount] = useState<8 | 16 | 26 | 52>(16);

  const weeks = data.weeks.slice(0, weekCount);
  const visibleWeeks = weeks;

  const gridCols = `repeat(${visibleWeeks.length}, minmax(${WEEK_COL_WIDTH}px, 1fr))`;

  return (
    <div className="flex flex-col rounded-sm border border-line bg-panel">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 text-xs text-ink-muted md:hidden">
          <span>Rentang waktu</span>
          {([8, 16, 26, 52] as const).map((n) => (
            <button
              key={n}
              onClick={() => setWeekCount(n)}
              className={`rounded-sm px-2 py-1 text-sm ${weekCount === n ? "bg-canal-soft font-medium text-canal" : "text-ink-muted hover:bg-surface"}`}
            >
              W{n}
            </button>
          ))}
        </div>
        <div className="relative overflow-x-auto overflow-y-hidden border-b border-line">
          <div className="relative min-w-[calc(100%+1px)]">
            {/* Identity header — sticky di kiri di mobile */}
            <div
              className="absolute top-0 left-0 z-20 border-r border-line bg-surface"
              style={{ height: HEADER_HEIGHT, width: IDENTITY_WIDTH }}
            >
              <div className="flex items-center border-b border-line px-3 py-1">
                <span className="text-xs font-medium text-ink-muted">No.</span>
              </div>
              <div className="absolute top-[32px] right-0 bottom-0 left-0 border-b border-line px-3">
                <span className="text-xs font-medium text-ink-muted">
                  Job Item
                </span>
              </div>
            </div>

            {/* Week header */}
            <div className="relative" style={{ marginLeft: IDENTITY_WIDTH }}>
              <div
                className="grid border-b border-line bg-surface"
                style={{ gridTemplateColumns: gridCols }}
              >
                {visibleWeeks.map((week) => (
                  <div
                    key={week.weekStart}
                    className="border-r border-line px-2 py-2 text-center text-[10px] font-medium text-ink-muted"
                    title={formatGanttDate(
                      new Date(week.weekStart + "T00:00:00Z"),
                    )}
                  >
                    {formatGanttWeek(new Date(week.weekStart + "T00:00:00Z"))}
                  </div>
                ))}
              </div>

              {/* Today edge line */}
              {data.todayWeekIndex !== null &&
                data.todayWeekIndex < visibleWeeks.length && (
                  <div
                    className="absolute top-[56px] bottom-0 w-[2px] bg-gantt-edge"
                    style={{
                      left: `${IDENTITY_WIDTH + data.todayWeekIndex * WEEK_COL_WIDTH}px`,
                      zIndex: 10,
                    }}
                  />
                )}

              {/* Rows */}
              <div className="relative">
                {/* Identitas baris (sticky di kiri, mobile) */}
                <div
                  className="absolute top-0 left-0 z-20 border-r border-line bg-surface"
                  style={{ width: IDENTITY_WIDTH }}
                >
                  {data.rows.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-center border-b border-line px-3 py-1 text-sm ${row.level === 0 ? "font-semibold text-ink" : "text-ink-muted"} ${row.level > 0 ? "pl-4" : ""}`}
                      style={{
                        height: ROW_HEIGHT,
                        paddingLeft: `${20 + row.level * 20}px`,
                        width: IDENTITY_WIDTH,
                      }}
                    >
                      {row.label}
                    </div>
                  ))}
                </div>

                {/* Sel Gantt */}
                <div
                  className="relative"
                  style={{ marginLeft: IDENTITY_WIDTH }}
                >
                  {data.rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid border-b border-line"
                      style={{
                        gridTemplateColumns: gridCols,
                        height: ROW_HEIGHT,
                      }}
                    >
                      {row.cells.slice(0, weekCount).map((cell, j) => {
                        const cellClass =
                          cell.color === "base"
                            ? "bg-gantt-base"
                            : cell.color === "rev1"
                              ? "bg-gantt-rev1"
                              : cell.color === "rev2"
                                ? "bg-gantt-rev2"
                                : "bg-transparent";
                        return (
                          <div
                            key={j}
                            className={`flex items-center justify-center border-r border-line text-[10px] font-medium ${cellClass}`}
                            title={cell.tooltip ?? undefined}
                          >
                            {cell.symbol}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: switcher rentang waktu di kanan header atau tersembunyi */}
        <div className="hidden items-center gap-2 border-b border-line bg-surface px-3 py-2 text-xs text-ink-muted md:flex">
          <span>Rentang waktu</span>
          {([8, 16, 26, 52] as const).map((n) => (
            <button
              key={n}
              onClick={() => setWeekCount(n)}
              className={`rounded-sm px-2 py-1 text-sm ${weekCount === n ? "bg-canal-soft font-medium text-canal" : "text-ink-muted hover:bg-surface"}`}
            >
              W{n}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-line bg-surface px-3 py-2 text-xs text-ink-muted">
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-line bg-gantt-base" />{" "}
          Rencana
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-gantt-rev1" /> Revisi 1
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-gantt-rev2" /> Revisi 2+
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="h-3 w-3 border border-line" /> # Berjalan
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 border border-line" /> ✓ Selesai
        </span>
      </div>
    </div>
  );
}
