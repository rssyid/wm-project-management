import { Prisma } from "@/generated/prisma/client";

/** Uang, bobot, dan persen mengikuti kolom Decimal di schema; arithmetic memakai Decimal (rule 20). */
export type DecimalValue = Prisma.Decimal;

export function decimal(value: string | number | DecimalValue): DecimalValue {
  return new Prisma.Decimal(value);
}

/** Nol desimal typed supaya penjumlahan baris BOQ tidak kehilangan presisi. */
export const ZERO = (): DecimalValue => new Prisma.Decimal(0);

export function sumDecimal(values: readonly DecimalValue[]): DecimalValue {
  return values.reduce<DecimalValue>(
    (total, value) => total.plus(value),
    ZERO(),
  );
}

/** Klien menerima angka uang sebagai string desimal (rule 20). */
export function decimalToString(
  value: DecimalValue | null | undefined,
): string | null {
  return value === null || value === undefined ? null : value.toFixed(2);
}
