import type { Tx } from "@/infra/tx";
import { todayBusinessDateIso } from "@/shared/date";

/**
 * AC-10: kode `WM-{Company.code}-{YYYY}-{SEQ4}` berurutan per Company per tahun dan aman saat
 * dua proyek dibuat bersamaan. `INSERT … ON CONFLICT DO UPDATE … RETURNING` mengunci baris
 * counter selama satu statement, jadi tanpa SELECT FOR UPDATE terpisah pun tidak ada nomor
 * ganda atau lompatan angka.
 */
export async function nextProjectCode(
  tx: Tx,
  companyCode: string,
  companyId: string,
): Promise<string> {
  const year = Number(todayBusinessDateIso().slice(0, 4));
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "ProjectCodeCounter" ("companyId", "year", "lastSeq")
    VALUES (${companyId}, ${year}, 1)
    ON CONFLICT ("companyId", "year")
    DO UPDATE SET "lastSeq" = "ProjectCodeCounter"."lastSeq" + 1
    RETURNING "lastSeq"
  `;
  const lastSeq = rows[0]?.lastSeq;
  if (lastSeq === undefined) {
    throw new Error("Counter kode proyek tidak mengembalikan nomor.");
  }
  return `WM-${companyCode}-${year}-${String(lastSeq).padStart(4, "0")}`;
}
