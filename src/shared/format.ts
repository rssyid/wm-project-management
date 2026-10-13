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

const dateShort = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
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

/** `3 Agu` — Gantt week headers where the year is shown elsewhere. */
export function formatShortDate(value: Date): string {
  return dateShort.format(value);
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
