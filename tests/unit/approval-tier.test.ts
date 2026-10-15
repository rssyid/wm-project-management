import { describe, expect, it } from "vitest";

import { assertNoOverlapOrGap, matchTier } from "@/domain/approval-matrix/tier";
import { decimal } from "@/infra/decimal";
import { DomainError } from "@/shared/errors";

function tier(
  name: string,
  min: string,
  max: string | null,
  options: { forAfce?: boolean; isActive?: boolean } = {},
) {
  return {
    id: name,
    name,
    forAfce: options.forAfce ?? true,
    forArSupplement: !options.forAfce,
    minAmount: decimal(min),
    maxAmount: max === null ? null : decimal(max),
    isActive: options.isActive ?? true,
  };
}

describe("AC-18 batas tier bawah inklusif dan atas eksklusif", () => {
  const tiers = [
    tier("rendah", "0", "500000000"),
    tier("tinggi", "500000000", null),
  ];

  it("nilai tepat pada batas bawah masuk tier tersebut", () => {
    expect(matchTier(tiers, "AFCE", decimal("0"))?.name).toBe("rendah");
    expect(matchTier(tiers, "AFCE", decimal("500000000"))?.name).toBe("tinggi");
  });

  it("nilai tepat pada batas atas tidak masuk tier sebelumnya", () => {
    expect(matchTier(tiers, "AFCE", decimal("499999999.99"))?.name).toBe(
      "rendah",
    );
    expect(matchTier(tiers, "AFCE", decimal("500000000.01"))?.name).toBe(
      "tinggi",
    );
  });

  it("nilai di bawah batas bawah tidak punya tier", () => {
    const turun = [tier("tengah", "1000000", null)];
    expect(matchTier(turun, "AFCE", decimal("999999.99"))).toBeNull();
  });

  it("tier AFCE tidak dipakai untuk AR tambahan", () => {
    const khususAr = [tier("khusus-ar", "0", null, { forAfce: false })];
    expect(matchTier(khususAr, "AR", decimal("10"))?.name).toBe("khusus-ar");
    expect(matchTier(khususAr, "AFCE", decimal("10"))).toBeNull();
  });

  it("tier nonaktif diabaikan", () => {
    const nonaktif = [tier("mati", "0", null, { isActive: false })];
    expect(matchTier(nonaktif, "AFCE", decimal("10"))).toBeNull();
  });
});

describe("validasi rentang tier", () => {
  it("menerjemahkan rentang yang berurutan tanpa celah", () => {
    expect(() =>
      assertNoOverlapOrGap(
        [
          tier("a", "0", "1000"),
          tier("b", "1000", "5000"),
          tier("c", "5000", null),
        ],
        "AFCE",
      ),
    ).not.toThrow();
  });

  it("menolak rentang yang tumpang tindih", () => {
    try {
      assertNoOverlapOrGap(
        [tier("a", "0", "1500"), tier("b", "1000", null)],
        "AFCE",
      );
      throw new Error(" should've menolak tumpang tindih");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).message).toContain("tumpang tindih");
    }
  });

  it("menolak rentang yang berlubang", () => {
    try {
      assertNoOverlapOrGap(
        [tier("a", "0", "1000"), tier("b", "2000", null)],
        "AFCE",
      );
      throw new Error(" should've menolak lubang");
    } catch (error) {
      expect((error as DomainError).message).toContain("tanpa tier");
    }
  });

  it("menolak tier tanpa batas atas diikuti tier lain", () => {
    try {
      assertNoOverlapOrGap(
        [tier("a", "0", null), tier("b", "1000", null)],
        "AFCE",
      );
      throw new Error(" should've menolak tier terbuka lebih dulu");
    } catch (error) {
      expect((error as DomainError).message).toContain("tanpa batas atas");
    }
  });

  it("hanya memeriksa tier yang berlaku untuk jenis dokumen", () => {
    const tiers = [tier("afce", "0", null, { forAfce: true })];
    expect(() => assertNoOverlapOrGap(tiers, "AFCE")).not.toThrow();
  });
});
