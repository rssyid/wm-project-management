// docs/01 §10–11: semua perhitungan progres dan EWS ada di sini. UI, laporan,
// dan ekspor tidak boleh menghitung ulang.
import { decimal, sumDecimal, type DecimalValue } from "@/infra/decimal";
import { todayBusinessDateIso } from "@/shared/date";
import { DomainError } from "@/shared/errors";
import {
  EWS_LEVEL_LABEL,
  type EwsLevel,
  type ProjectStatus,
  PROJECT_STATUS_LABEL,
} from "@/shared/project-status";

const HUNDRED = decimal("100.00");
const ZERO = decimal("0");

/** Ambang default disesuaikan lewat SystemSetting saat dibaca dari database. */
export const DEFAULT_EWS_YELLOW_FROM = decimal("5");
export const DEFAULT_EWS_RED_ABOVE = decimal("10");

type EwsInput = {
  deviationPct: DecimalValue;
  yellowFrom: DecimalValue;
  redAbove: DecimalValue;
};

function classifyEws(input: EwsInput): EwsLevel {
  const { deviationPct, yellowFrom, redAbove } = input;
  const abs = deviationPct.abs();
  if (abs.lessThan(yellowFrom)) return "GREEN";
  if (abs.lessThanOrEqualTo(redAbove)) return "YELLOW";
  return "RED";
}

/** Bobot aktif Pekerjaan per proyek harus tepat 100,00. */
export function assertProjectWeights(
  items: readonly { projectWeightPct: DecimalValue }[],
): void {
  const total = sumDecimal(items.map((i) => i.projectWeightPct));
  if (!total.equals(HUNDRED)) {
    throw new DomainError(
      "WEIGHT_MISMATCH",
      `Total bobot Pekerjaan ${total.toFixed(2)}%. Harus tepat 100,00%.`,
    );
  }
}

/** Bobot fisik + material satu Pekerjaan harus tepat 100. */
export function assertWorkItemWeights(
  physical: DecimalValue,
  material: DecimalValue,
): void {
  const total = physical.plus(material);
  if (!total.equals(HUNDRED)) {
    throw new DomainError(
      "WEIGHT_MISMATCH",
      `Bobot fisik dan material berjumlah ${total.toFixed(2)}%. Harus tepat 100,00%.`,
    );
  }
}

/** Bobot paket aktif per Pekerjaan harus tepat sama dengan bobot material Pekerjaan. */
export function assertPackageWeights(
  physical: DecimalValue,
  packages: readonly { weightPct: DecimalValue }[],
): void {
  const total = sumDecimal(packages.map((p) => p.weightPct));
  if (!total.equals(physical)) {
    throw new DomainError(
      "WEIGHT_MISMATCH",
      `Total bobot paket ${total.toFixed(2)}%. Harus sama dengan bobot material Pekerjaan ${physical.toFixed(2)}%.`,
    );
  }
}

/**
 * AC-49: Progres paket = rata-rata per item min(diterima/rencana, 1) × 100.
 * Contoh uji: item terima 20/rencana 50 → 40%.
 */
export function packageProgress(
  items: readonly {
    plannedQty: DecimalValue;
    deliveredQty: DecimalValue;
  }[],
): DecimalValue {
  if (items.length === 0) return ZERO;
  const total = sumDecimal(
    items.map((item) => {
      const ratio = item.deliveredQty.div(item.plannedQty);
      return ratio.lessThanOrEqualTo(decimal("1")) ? ratio : decimal("1");
    }),
  );
  return total.div(decimal(items.length)).times(decimal("100"));
}

/**
 * AC-49: Progres Pekerjaan = fisik × wFisik/100 + Σ paket × w_p/100.
 * PURCHASE: fisik 0/material 100 → progres dari paket saja.
 */
export function workItemProgress({
  physicalPct,
  materialPct,
  physicalProgressPct,
  packageProgresses,
}: {
  physicalPct: DecimalValue;
  materialPct: DecimalValue;
  physicalProgressPct: DecimalValue;
  packageProgresses: DecimalValue[];
}): DecimalValue {
  const physicalPart = physicalProgressPct
    .times(physicalPct)
    .div(decimal("100"));
  const materialPart = sumDecimal(
    packageProgresses.map((p) => p.times(materialPct).div(decimal("100"))),
  );
  return physicalPart.plus(materialPart);
}

/**
 * AC-49: Progres proyek = Σ Pekerjaan_i × w_i/100.
 * Contoh uji: A 59,0% @60% + B 75,0% @40% = 65,4%.
 */
export function projectProgress(
  items: readonly {
    projectWeightPct: DecimalValue;
    progressPct: DecimalValue;
  }[],
): DecimalValue {
  return sumDecimal(
    items.map((i) =>
      i.progressPct.times(i.projectWeightPct).div(decimal("100")),
    ),
  );
}

/**
 * AC-50: % rencana linear per hari kerja dari baseline start s.d. t.
 * Hari kerja = SystemSetting.workingWeekdays dikurangi Holiday.
 * Freeze ON_HOLD dan JEDA_SPK_BATAL: hari kerja tidak dihitung.
 */
export type PlannedPercentInput = {
  baselineStartIso: string;
  baselineEndIso: string;
  targetIso: string;
  workingWeekdays: readonly number[];
  holidays: readonly string[];
  frozenDays: readonly string[];
};

export function plannedPercent(input: PlannedPercentInput): DecimalValue {
  const {
    baselineStartIso,
    baselineEndIso,
    targetIso,
    workingWeekdays,
    holidays,
    frozenDays,
  } = input;

  const weekdaySet = new Set(workingWeekdays);
  const holidaySet = new Set(holidays);
  const frozenSet = new Set(frozenDays);

  const totalWorking = countWorkingDays(
    baselineStartIso,
    baselineEndIso,
    weekdaySet,
    holidaySet,
    frozenSet,
  );
  if (totalWorking === 0) return ZERO;

  const targetWorking = countWorkingDays(
    baselineStartIso,
    targetIso,
    weekdaySet,
    holidaySet,
    frozenSet,
  );

  const pct = decimal(targetWorking)
    .times(decimal("100"))
    .div(decimal(totalWorking));
  return pct.lessThan(decimal("0"))
    ? ZERO
    : pct.greaterThan(decimal("100"))
      ? decimal("100")
      : pct;
}

function countWorkingDays(
  fromIso: string,
  toIso: string,
  weekdaySet: Set<number>,
  holidaySet: Set<string>,
  frozenSet: Set<string>,
): number {
  if (compareBusinessDate(toIso, fromIso) < 0) return 0;
  let count = 0;
  const cursor = new Date(Date.UTC(...isoParts(fromIso)));
  while (compareBusinessDate(businessDateIso(cursor), toIso) <= 0) {
    const iso = businessDateIso(cursor);
    const weekday = cursor.getUTCDay() || 7; // Minggu = 7
    if (
      weekdaySet.has(weekday) &&
      !holidaySet.has(iso) &&
      !frozenSet.has(iso)
    ) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function isoParts(iso: string): [number, number, number] {
  const parts = iso.split("-").map((v) => Number(v));
  return [parts[0]!, parts[1]! - 1, parts[2]!];
}

function businessDateIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function compareBusinessDate(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * AC-51: Deviasi = % rencana − % aktual. Ambang: <5 hijau, 5–10 kuning, >10 merah.
 * Ambang diambil dari SystemSetting (ewsYellowFrom / ewsRedAbove).
 */
export function ewsLevel(input: EwsInput): { level: EwsLevel; label: string } {
  const level = classifyEws(input);
  return { level, label: EWS_LEVEL_LABEL[level] };
}

/**
 * AC-52: Hari freeze (ON_HOLD proyek / JEDA_SPK_BATAL fisik) dikumpulkan per rentang.
 * Digunakan pemanggil untuk menambahkan frozenDays ke plannedPercent.
 */
export function freezeDays(
  ranges: readonly { fromIso: string; toIso: string }[],
): string[] {
  const days = new Set<string>();
  for (const { fromIso, toIso } of ranges) {
    let cursor = new Date(Date.UTC(...isoParts(fromIso)));
    const end = new Date(Date.UTC(...isoParts(toIso)));
    while (cursor <= end) {
      days.add(businessDateIso(cursor));
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }
  return Array.from(days).sort();
}

/** Data EWS untuk satu proses/Pekerjaan/proyek (digunakan API dan Gantt F5). */
export type EwsSnapshot = {
  plannedPct: string;
  actualPct: string;
  deviationPct: string;
  level: EwsLevel;
  label: string;
};

/** Hitung snapshot EWS lengkap (AC-50, AC-51). */
export function computeEws({
  plannedPct,
  actualPct,
  yellowFrom,
  redAbove,
}: {
  plannedPct: DecimalValue;
  actualPct: DecimalValue;
  yellowFrom: DecimalValue;
  redAbove: DecimalValue;
}): EwsSnapshot {
  const deviation = actualPct.minus(plannedPct);
  const { level, label } = ewsLevel({
    deviationPct: deviation,
    yellowFrom,
    redAbove,
  });
  return {
    plannedPct: plannedPct.toFixed(2),
    actualPct: actualPct.toFixed(2),
    deviationPct: deviation.toFixed(2),
    level,
    label,
  };
}

/** Status proyek yang membeku progres fisik (docs/01 §5, §11). */
export function isFrozenProjectStatus(status: ProjectStatus): boolean {
  return status === "ON_HOLD";
}

/** Label status untuk tampilan (D-22, docs/05 §9). */
export function projectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABEL[status];
}

/** Hari ini di Asia/Jakarta (dibandingkan dengan weekStart log progres). */
export function todayIso(): string {
  return todayBusinessDateIso();
}
