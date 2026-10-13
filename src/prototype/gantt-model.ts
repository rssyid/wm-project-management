// Logika model Gantt yang bebas dari render, supaya bisa diuji tanpa browser.

export type OutlineCounters = { major: number; minor: number };

/**
 * Penomoran outline: jenjang 0 `#`, jenjang 1 angka, jenjang 2 huruf yang mengulang
 * dari `a` di setiap anak jenjang 1. `counters` dimutasi; pemanggil harus memakai
 * satu objek untuk seluruh tabel.
 */
export function outlineNumber(
  depth: number,
  counters: OutlineCounters,
): string {
  if (depth === 0) return "#";
  if (depth === 1) {
    counters.major += 1;
    counters.minor = 0;
    return String(counters.major);
  }
  counters.minor += 1;
  return String.fromCharCode(96 + counters.minor);
}

/** Nomor untuk seluruh baris, dihitung sekali per tabel. */
export function outlineNumbers(depths: readonly number[]): string[] {
  const counters: OutlineCounters = { major: 0, minor: 0 };
  return depths.map((depth) => outlineNumber(depth, counters));
}

const MS_PER_DAY = 86_400_000;
const WIB_OFFSET = "+07:00";

/**
 * Indeks minggu berjalan 1-based, atau `null` kalau belum ada jadwal.
 *
 * Memakai `Date.now()` dan hanya boleh dipanggil setelah mount. `docs/01` §11
 * menetapkan "minggu dengan tanggal hari ini", sedangkan hitungan di server ditolak
 * `cacheComponents` Next 16 saat prerender — sama seperti TZDate di D-25.
 * `now` dapat dikunci agar hasil fungsi ini bisa diuji.
 */
export function currentWeekIndex(
  firstMonday: string,
  now: number = Date.now(),
): number | null {
  const anchor = Date.parse(`${firstMonday}T00:00:00${WIB_OFFSET}`);
  if (Number.isNaN(anchor)) return null;
  // WIB tidak punya DST, jadi selisih hari bisa dibagi langsung.
  const index = Math.floor((now - anchor) / MS_PER_DAY / 7) + 1;
  return index >= 1 ? index : null;
}
