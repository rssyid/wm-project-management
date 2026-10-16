import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/shared/errors";

/** Jenis dokumen yang memakai matriks; AFCE memakai nilai AFCE, AR memakai nominal tambahan (D-08). */
export type TierDoc = "AFCE" | "AR";

export type TierForMatch = {
  id: string;
  name: string;
  forAfce: boolean;
  forArSupplement: boolean;
  minAmount: Prisma.Decimal;
  maxAmount: Prisma.Decimal | null;
  isActive: boolean;
};

function appliesTo(doc: TierDoc, tier: TierForMatch): boolean {
  return doc === "AFCE" ? tier.forAfce : tier.forArSupplement;
}

/**
 * Batas tier bawah inklusif dan atas eksklusif; `maxAmount` null berarti tanpa batas atas
 * (D-09). AC-18: pengajuan tanpa tier cocok ditolak, bukan diam-diam memakai tier terdekat.
 */
export function matchTier<T extends TierForMatch>(
  tiers: readonly T[],
  doc: TierDoc,
  amount: Prisma.Decimal,
): T | null {
  for (const tier of tiers) {
    if (!tier.isActive || !appliesTo(doc, tier)) continue;
    if (amount.greaterThanOrEqualTo(tier.minAmount)) {
      if (tier.maxAmount === null || amount.lessThan(tier.maxAmount)) {
        return tier;
      }
    }
  }
  return null;
}

export function noMatchingTierError(doc: TierDoc, amount: Prisma.Decimal) {
  return new DomainError(
    "PRECONDITION_FAILED",
    `Tidak ada tier matriks approval untuk ${doc} senilai ${amount.toFixed(2)}. Hubungi Super Admin.`,
  );
}

/**
 * Rentang tier aktif per jenis dokumen tidak boleh tumpang tindih atau berlubang
 * (docs/03 §4): setiap tier berikutnya harus mulai tepat pada batas atas tier sebelumnya.
 * Nominal di luar rentang tier yang ada tidak dianggap kesalahan di sini; saat pengajuan
 * `matchTier` mengembalikan null dan pengajuan ditolak.
 */
export function assertNoOverlapOrGap(
  tiers: readonly TierForMatch[],
  doc: TierDoc,
): void {
  const ranges = tiers
    .filter((tier) => tier.isActive && appliesTo(doc, tier))
    .map((tier) => ({
      name: tier.name,
      min: tier.minAmount,
      max: tier.maxAmount,
    }))
    .sort((left, right) => left.min.comparedTo(right.min));

  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1];
    const current = ranges[index];
    if (!previous || !current) continue;
    if (previous.max === null) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `Tier "${previous.name}" tanpa batas atas membuat tier "${current.name}" tumpang tindih.`,
      );
    }
    if (previous.max.greaterThan(current.min)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `Rentang tier "${previous.name}" dan "${current.name}" tumpang tindih.`,
      );
    }
    if (previous.max.lessThan(current.min)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `Ada nominal di antara "${previous.name}" dan "${current.name}" tanpa tier.`,
      );
    }
  }
}
