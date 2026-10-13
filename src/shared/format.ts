// docs/02 §5: timestamps are stored in UTC and always shown in WIB.
const APP_TIME_ZONE = "Asia/Jakarta";

// Intl instead of @date-fns/tz: TZDate calls `new Date()` internally, which Next 16
// cacheComponents rejects during prerender.
const dateLong = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

// D-29: Gantt memakai tanggal numerik karena kolom minggunya sempit dan label bulan
// panjang tidak muat. Helper ini hanya dipakai Gantt; tabel lain tetap format panjang.
const dateNumeric = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: APP_TIME_ZONE,
});

const dateNumericNoYear = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIME_ZONE,
});

const rupiah = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const oneDecimal = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `10 Okt 2026` in Asia/Jakarta. */
export function formatDate(value: Date): string {
  return dateLong.format(value);
}

/** D-29: `13/10/26` — Gantt Plan mulai dan Plan selesai. */
export function formatGanttDate(value: Date): string {
  return dateNumeric.format(value);
}

/** D-29: `12/10` — Gantt kolom minggu; tahun sudah tampil di Plan mulai. */
export function formatGanttWeek(value: Date): string {
  return dateNumericNoYear.format(value);
}

/** `Rp1.250.000.000`. Money arrives as a Decimal string (rule 20), so strings are accepted as-is. */
export function formatRupiah(value: string | number): string {
  return `Rp${rupiah.format(value as Intl.StringNumericLiteral)}`;
}

/** `12,3` — EWS deviation and other one-decimal figures. */
export function formatDecimal(value: string | number): string {
  return oneDecimal.format(value as Intl.StringNumericLiteral);
}

/** `65,4%`. */
export function formatPercent(value: string | number): string {
  return `${formatDecimal(value)}%`;
}
