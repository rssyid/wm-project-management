import { DomainError } from "@/shared/errors";

/**
 * Tanggal bisnis disimpan sebagai kolom @db.Date. Prisma menulis kolom itu dari komponen UTC,
 * sedangkan driver pg membacanya sebagai tengah malam waktu lokal server; karena itu tanggal
 * selalu dinormalkan ke string `YYYY-MM-DD` sebelum dibandingkan (rule 20).
 */

const APP_TIME_ZONE = "Asia/Jakarta";
const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function partsOf(value: Date): { year: number; month: number; day: number } {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

/** `2026-10-14` → tengah malam UTC, aman ditulis ke kolom @db.Date. */
export function parseBusinessDate(value: string): Date {
  const match = BUSINESS_DATE_PATTERN.exec(value.trim());
  if (!match) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Tanggal "${value}" tidak sesuai format YYYY-MM-DD.`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const parts = partsOf(date);
  if (
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Tanggal "${value}" tidak ada di kalender.`,
    );
  }
  return date;
}

/** Tanggal hasil baca database → `YYYY-MM-DD` memakai komponen lokal, seperti driver pg. */
export function businessDateIso(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${month}-${day}`;
}

/** Tanggal hari ini di Asia/Jakarta, bukan tanggal server (D-25). */
export function todayBusinessDateIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function utcFromIso(iso: string): number {
  const match = BUSINESS_DATE_PATTERN.exec(iso);
  if (!match) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Tanggal "${iso}" tidak sesuai format YYYY-MM-DD.`,
    );
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Urutan tanggal examined lewat perbandingan string; format sama panjang selalu dapat dibandingkan. */
export function compareBusinessDate(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Selisih hari kalender (docs/01 §6: durasi level memakai hari kalender). */
export function calendarDaysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcFromIso(toIso) - utcFromIso(fromIso)) / 86_400_000);
}

export function addCalendarDays(iso: string, days: number): string {
  const shifted = new Date(utcFromIso(iso) + days * 86_400_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}