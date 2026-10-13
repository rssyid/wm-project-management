import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// docs/02 §5: timestamps are stored in UTC and always shown in WIB.
export const APP_TIME_ZONE = "Asia/Jakarta";

const rupiah = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `10 Okt 2026` in Asia/Jakarta. */
export function formatDate(value: Date): string {
  return format(new TZDate(value, APP_TIME_ZONE), "d MMM yyyy", { locale: id });
}

/** `Rp1.250.000.000`. Money arrives as a Decimal string (rule 20), so strings are accepted as-is. */
export function formatRupiah(value: string | number): string {
  return `Rp${rupiah.format(value as Intl.StringNumericLiteral)}`;
}

/** `65,4%`. */
export function formatPercent(value: string | number): string {
  return `${percent.format(value as Intl.StringNumericLiteral)}%`;
}
