// docs/01 §11: data sel Gantt matriks mingguan. Semua angka progres/EWS berasal
// dari progress-ews; UI dan query tidak menghitung ulang.
import { decimal, type DecimalValue } from "@/infra/decimal";
import { todayBusinessDateIso } from "@/shared/date";
import { DomainError } from "@/shared/errors";
import type { EwsLevel } from "@/shared/project-status";
import { prisma } from "@/infra/db";
import { businessDateIso, compareBusinessDate } from "@/shared/date";

export type GanttCellColor = "base" | "rev1" | "rev2" | null;

export type GanttCell = {
  weekStart: string;
  color: GanttCellColor;
  symbol: "#" | "✓" | null;
  tooltip: string | null;
};

export type GanttRow = {
  id: string;
  type: "project" | "workItem" | "tenderAttempt" | "physical" | "workPackage";
  label: string;
  level: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: string | null;
  progressPct: string | null;
  ewsLevel: EwsLevel | null;
  cells: GanttCell[];
};

export type GanttProjectData = {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectStatus: string;
  weeks: { weekStart: string; label: string }[];
  rows: GanttRow[];
  todayWeekIndex: number | null;
};

type PlannedRange = { start: string; end: string } | null;

export function mondayOf(iso: string): string {
  const parts = iso.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return businessDateIso(d);
}

export function addWeeks(iso: string, n: number): string {
  const parts = iso.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  d.setUTCDate(d.getUTCDate() + n * 7);
  return businessDateIso(d);
}

export function weekLabel(iso: string): string {
  const parts = iso.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}/${m}`;
}

export function inRange(weekStart: string, fromIso: string, toIso: string): boolean {
  return compareBusinessDate(weekStart, fromIso) >= 0 && compareBusinessDate(weekStart, toIso) <= 0;
}

export function cellColorFor(
  weekStart: string,
  baseline: PlannedRange,
  revisions: readonly { start: string; end: string; revisionNo: number }[],
): GanttCellColor {
  const applicable = revisions
    .filter((r) => inRange(weekStart, r.start, r.end))
    .sort((a, b) => a.revisionNo - b.revisionNo);
  if (applicable.length > 0 && applicable[0]) {
    return applicable[0].revisionNo === 1 ? "rev1" : "rev2";
  }
  if (baseline && inRange(weekStart, baseline.start, baseline.end)) {
    return "base";
  }
  return null;
}

export function cellSymbolFor(
  rowType: GanttRow["type"],
  weekStart: string,
  actualStart: string | null,
  actualEnd: string | null,
  progressPct: DecimalValue | null,
): "#" | "✓" | null {
  if (rowType === "physical") {
    if (
      progressPct !== null &&
      progressPct.greaterThanOrEqualTo(decimal("100")) &&
      actualEnd !== null &&
      compareBusinessDate(weekStart, actualEnd) >= 0
    ) {
      return "✓";
    }
    return null;
  }
  if (rowType === "tenderAttempt") {
    if (actualStart !== null && compareBusinessDate(weekStart, actualStart) >= 0) {
      return "#";
    }
    return null;
  }
  if (rowType === "workPackage") {
    if (actualEnd !== null && compareBusinessDate(weekStart, actualEnd) >= 0) {
      return "✓";
    }
    if (actualStart !== null && compareBusinessDate(weekStart, actualStart) >= 0) {
      return "#";
    }
    return null;
  }
  return null;
}

type RawRow = {
  id: string;
  type: GanttRow["type"];
  label: string;
  level: number;
  planned: PlannedRange;
  revisions: readonly { start: string; end: string; revisionNo: number }[];
  actualStart: string | null;
  actualEnd: string | null;
  status: string | null;
  progressPct: DecimalValue | null;
};

export async function getGanttProject(projectId: string): Promise<GanttProjectData> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  });
  if (!project) throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");

  const workItems = await prisma.workItem.findMany({
    where: { projectId, cancelledAt: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      tenderAttempts: {
        orderBy: { attemptNo: "asc" },
        select: {
          id: true,
          attemptNo: true,
          status: true,
          actualStart: true,
          actualEnd: true,
          baseline: {
            select: {
              id: true,
              plannedStart: true,
              plannedEnd: true,
              revisions: {
                orderBy: { revisionNo: "asc" },
                select: { id: true, revisionNo: true, plannedStart: true, plannedEnd: true },
              },
            },
          },
        },
      },
      physicalProcess: {
        select: {
          id: true,
          status: true,
          actualStart: true,
          actualEnd: true,
          progressLogs: {
            orderBy: { weekStart: "asc" },
            select: { id: true, weekStart: true, cumulativePct: true, supersededById: true },
          },
          baselines: {
            select: { id: true, plannedStart: true, plannedEnd: true },
          },
        },
      },
      workPackages: {
        where: { cancelledDate: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          completedDate: true,
          purchaseRequest: { select: { id: true, date: true } },
          baseline: {
            select: {
              id: true,
              plannedStart: true,
              plannedEnd: true,
              revisions: {
                orderBy: { revisionNo: "asc" },
                select: { id: true, revisionNo: true, plannedStart: true, plannedEnd: true },
              },
            },
          },
          items: {
            select: {
              id: true,
              plannedQty: true,
              deliveryItems: { select: { id: true, qty: true } },
            },
          },
        },
      },
    },
  });

  const allDates: string[] = [];
  const rawRows: RawRow[] = [];

  for (const wi of workItems) {
    const wiDates: string[] = [];
    const processRows: RawRow[] = [];

    // Tender attempts
    for (const attempt of wi.tenderAttempts) {
      const baseline = attempt.baseline;
      const planned: PlannedRange = baseline
        ? {
            start: businessDateIso(baseline.plannedStart) ?? "",
            end: businessDateIso(baseline.plannedEnd) ?? "",
          }
        : null;
      const revisions = baseline?.revisions
        ? baseline.revisions.map((r) => ({
            start: businessDateIso(r.plannedStart) ?? "",
            end: businessDateIso(r.plannedEnd) ?? "",
            revisionNo: r.revisionNo,
          }))
        : [];
      if (baseline) {
        const s = businessDateIso(baseline.plannedStart) ?? "";
        const e = businessDateIso(baseline.plannedEnd) ?? "";
        wiDates.push(s, e);
        allDates.push(s, e);
      }
      for (const r of revisions) {
        wiDates.push(r.start, r.end);
        allDates.push(r.start, r.end);
      }
      if (attempt.actualStart) {
        const s = businessDateIso(attempt.actualStart) ?? "";
        wiDates.push(s);
        allDates.push(s);
      }
      if (attempt.actualEnd) {
        const e = businessDateIso(attempt.actualEnd) ?? "";
        wiDates.push(e);
        allDates.push(e);
      }

      processRows.push({
        id: attempt.id,
        type: "tenderAttempt",
        label: `Tender #${attempt.attemptNo}`,
        level: 2,
        planned,
        revisions,
        actualStart: attempt.actualStart ? (businessDateIso(attempt.actualStart) ?? null) : null,
        actualEnd: attempt.actualEnd ? (businessDateIso(attempt.actualEnd) ?? null) : null,
        status: attempt.status,
        progressPct: null,
      });
    }

    // Physical process
    if (wi.physicalProcess) {
      const phys = wi.physicalProcess;
      const base = phys.baselines[0];
      const planned: PlannedRange = base
        ? {
            start: businessDateIso(base.plannedStart) ?? "",
            end: businessDateIso(base.plannedEnd) ?? "",
          }
        : null;
      const revisions: { start: string; end: string; revisionNo: number }[] = [];
      if (base) {
        const s = businessDateIso(base.plannedStart) ?? "";
        const e = businessDateIso(base.plannedEnd) ?? "";
        wiDates.push(s, e);
        allDates.push(s, e);
      }
      if (phys.actualStart) {
        const s = businessDateIso(phys.actualStart) ?? "";
        wiDates.push(s);
        allDates.push(s);
      }
      if (phys.actualEnd) {
        const e = businessDateIso(phys.actualEnd) ?? "";
        wiDates.push(e);
        allDates.push(e);
      }

      const activeLogs = phys.progressLogs.filter((l) => l.supersededById === null);
      const latest =
        activeLogs.length > 0
          ? activeLogs.sort(
              (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime(),
            )[0]
          : null;
      const progressPct = latest ? decimal(latest.cumulativePct.toString()) : null;

      processRows.push({
        id: phys.id,
        type: "physical",
        label: "Fisik",
        level: 2,
        planned,
        revisions,
        actualStart: phys.actualStart ? (businessDateIso(phys.actualStart) ?? null) : null,
        actualEnd: phys.actualEnd ? (businessDateIso(phys.actualEnd) ?? null) : null,
        status: phys.status,
        progressPct,
      });
    }

    // Work packages
    for (const pkg of wi.workPackages) {
      const baseline = pkg.baseline;
      const planned: PlannedRange = baseline
        ? {
            start: businessDateIso(baseline.plannedStart) ?? "",
            end: businessDateIso(baseline.plannedEnd) ?? "",
          }
        : null;
      const revisions = baseline?.revisions
        ? baseline.revisions.map((r) => ({
            start: businessDateIso(r.plannedStart) ?? "",
            end: businessDateIso(r.plannedEnd) ?? "",
            revisionNo: r.revisionNo,
          }))
        : [];
      if (baseline) {
        const s = businessDateIso(baseline.plannedStart) ?? "";
        const e = businessDateIso(baseline.plannedEnd) ?? "";
        wiDates.push(s, e);
        allDates.push(s, e);
      }
      for (const r of revisions) {
        wiDates.push(r.start, r.end);
        allDates.push(r.start, r.end);
      }
      if (pkg.purchaseRequest) {
        const s = businessDateIso(pkg.purchaseRequest.date) ?? "";
        wiDates.push(s);
        allDates.push(s);
      }
      if (pkg.completedDate) {
        const e = businessDateIso(pkg.completedDate) ?? "";
        wiDates.push(e);
        allDates.push(e);
      }

      const plannedQtySum = decimal("0");
      const deliveredQtySum = decimal("0");
      for (const item of pkg.items) {
        plannedQtySum.plus(item.plannedQty);
        for (const di of item.deliveryItems ?? []) {
          deliveredQtySum.plus(di.qty);
        }
      }
      const pkgProgress = plannedQtySum.greaterThan(decimal("0"))
        ? deliveredQtySum.div(plannedQtySum).times(decimal("100"))
        : decimal("0");

      processRows.push({
        id: pkg.id,
        type: "workPackage",
        label: `Paket: ${pkg.name}`,
        level: 2,
        planned,
        revisions,
        actualStart: pkg.purchaseRequest
          ? (businessDateIso(pkg.purchaseRequest.date) ?? null)
          : null,
        actualEnd: pkg.completedDate ? (businessDateIso(pkg.completedDate) ?? null) : null,
        status: pkg.status,
        progressPct: pkgProgress,
      });
    }

    // Hitung range Pekerjaan dari anaknya.
    let wiPlanned: PlannedRange = null;
    if (wiDates.length > 0) {
      const sorted = wiDates.sort(compareBusinessDate);
      wiPlanned = {
        start: sorted[0]!,
        end: sorted[sorted.length - 1]!,
      };
    }

    rawRows.push({
      id: wi.id,
      type: "workItem",
      label: wi.name,
      level: 1,
      planned: wiPlanned,
      revisions: [],
      actualStart: null,
      actualEnd: null,
      status: null,
      progressPct: null,
    });

    for (const proc of processRows) {
      rawRows.push(proc);
    }
  }

  let w1: string | null = null;
  if (allDates.length > 0) {
    const sorted = allDates.sort(compareBusinessDate);
    w1 = mondayOf(sorted[0]!);
  }

  const weekCount = 16;
  const weeks: { weekStart: string; label: string }[] = [];
  let cursor = w1 ?? todayBusinessDateIso();
  for (let i = 0; i < weekCount; i++) {
    weeks.push({ weekStart: cursor, label: weekLabel(cursor) });
    cursor = addWeeks(cursor, 1);
  }

  const todayIsoStr = todayBusinessDateIso();
  const todayWeekIndex = weeks.findIndex(
    (w) =>
      compareBusinessDate(w.weekStart, todayIsoStr) <= 0 &&
      compareBusinessDate(addWeeks(w.weekStart, 1), todayIsoStr) > 0,
  );

  const rows: GanttRow[] = [];
  for (const raw of rawRows) {
    const cells: GanttCell[] = weeks.map((w) => {
      const color = cellColorFor(w.weekStart, raw.planned, raw.revisions);
      const symbol = cellSymbolFor(raw.type, w.weekStart, raw.actualStart, raw.actualEnd, raw.progressPct);
      let tooltip: string | null = null;
      if (color || symbol) {
        tooltip = `${raw.label}: ${w.label}`;
        if (raw.progressPct) tooltip += ` · progres ${raw.progressPct.toFixed(2)}%`;
      }
      return { weekStart: w.weekStart, color, symbol, tooltip };
    });
    rows.push({
      id: raw.id,
      type: raw.type,
      label: raw.label,
      level: raw.level,
      plannedStart: raw.planned?.start ?? null,
      plannedEnd: raw.planned?.end ?? null,
      actualStart: raw.actualStart,
      actualEnd: raw.actualEnd,
      status: raw.status,
      progressPct: raw.progressPct?.toFixed(2) ?? null,
      ewsLevel: null,
      cells,
    });
  }

  const projectRow: GanttRow = {
    id: project.id,
    type: "project",
    label: `${project.code} · ${project.name}`,
    level: 0,
    plannedStart: null,
    plannedEnd: null,
    actualStart: null,
    actualEnd: null,
    status: project.status,
    progressPct: null,
    ewsLevel: null,
    cells: weeks.map((w) => ({ weekStart: w.weekStart, color: null, symbol: null, tooltip: null })),
  };

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    projectStatus: project.status,
    weeks,
    rows: [projectRow, ...rows],
    todayWeekIndex: todayWeekIndex >= 0 ? todayWeekIndex : null,
  };
}
