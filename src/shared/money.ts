/**
 * Nominal uang selalu non-negatif dan maksimal dua desimal (money Decimal(18,2) di schema;
 * tier min ≥ 0, BOQ ≥ 0, anggaran ≥ 0). Pola ini dipakai skema Zod di klien maupun server.
 */
const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

export function isMoneyAmount(value: string): boolean {
  return MONEY_PATTERN.test(value.trim());
}

/** AR tambahan harus lebih besar dari nol (CHECK ar_amount_positive). */
export function isPositiveMoney(value: string): boolean {
  const trimmed = value.trim();
  return isMoneyAmount(trimmed) && /[1-9]/.test(trimmed);
}
