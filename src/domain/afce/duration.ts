import {
  businessDateIso,
  calendarDaysBetween,
  compareBusinessDate,
} from "@/shared/date";
import { DomainError } from "@/shared/errors";

export type DecisionLike = {
  result: "APPROVED" | "DITOLAK";
  decisionDate: Date | string;
};

export type DurationLevel = {
  levelNo: number;
  positionNameSnapshot: string;
  startDate: string;
  /** null bila level belum diputuskan; durasi memakai tanggal keputusan saat dibaca. */
  durationDays: number | null;
};

function iso(value: Date | string): string {
  return typeof value === "string" ? value : businessDateIso(value);
}

/**
 * AC-22: durasi dihitung saat dibaca dalam hari kalender. Level 1 dihitung dari tanggal email
 * approval, level berikutnya dari tanggal keputusan level sebelumnya (docs/01 §6).
 */
export function levelDurations(
  approvalEmailDate: string,
  levels: readonly (DecisionLike & { positionNameSnapshot: string })[],
): DurationLevel[] {
  return levels.map((level, index) => {
    const previous = levels[index - 1];
    const start =
      index === 0
        ? approvalEmailDate
        : iso(previous?.decisionDate ?? level.decisionDate);
    const end = iso(level.decisionDate);
    return {
      levelNo: index + 1,
      positionNameSnapshot: level.positionNameSnapshot,
      startDate: start,
      durationDays: calendarDaysBetween(start, end),
    };
  });
}

/**
 * AC-21: level N hanya boleh diputuskan setelah level sebelumnya Approved. Tanggal keputusan
 * tidak boleh di masa depan dan tidak boleh lebih awal dari titik awal level tersebut: level 1
 * dari tanggal email approval, level berikutnya dari keputusan level sebelumnya.
 */
export function assertDecisionAllowed(options: {
  decisionDate: string;
  today: string;
  approvalEmailDate: string;
  previousDecisions: readonly DecisionLike[];
}): void {
  const { decisionDate, today, approvalEmailDate, previousDecisions } = options;

  if (compareBusinessDate(decisionDate, today) > 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Tanggal keputusan tidak boleh di masa depan.",
    );
  }

  const previous = previousDecisions.at(-1);
  if (previous && previous.result !== "APPROVED") {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "Level sebelumnya sudah ditolak, sehingga level ini tidak bisa diputuskan.",
    );
  }

  const earliest =
    previousDecisions.length === 0
      ? approvalEmailDate
      : iso(previous?.decisionDate ?? approvalEmailDate);
  if (compareBusinessDate(decisionDate, earliest) < 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Tanggal keputusan tidak boleh lebih awal dari ${earliest}.`,
    );
  }
}
