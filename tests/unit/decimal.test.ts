import { describe, expect, it } from "vitest";

import {
  decimal,
  decimalEquals,
  decimalToString,
  sumDecimal,
  ZERO,
} from "@/infra/decimal";

describe("jumlah Decimal", () => {
  it("menjumlahkan baris BOQ tanpa kehilangan desimal", () => {
    const total = sumDecimal([
      decimal("1250000.10"),
      decimal("0.20"),
      decimal("999999999.99"),
    ]);
    expect(decimalToString(total)).toBe("1001250000.29");
  });

  it("menjumlahkan daftar kosong menjadi nol", () => {
    expect(decimalToString(sumDecimal([]))).toBe("0.00");
  });
});

describe("perbandingan Decimal", () => {
  it("menyatakan sama untuk nilai yang ditulis berbeda", () => {
    expect(decimalEquals(decimal("100.50"), decimal("100.5"))).toBe(true);
    expect(decimalEquals(ZERO(), decimal("-0.01"))).toBe(false);
  });
});

describe("serialisasi Decimal", () => {
  it("mengirim dua desimal ke klien", () => {
    expect(decimalToString(decimal("65.4"))).toBe("65.40");
    expect(decimalToString(null)).toBeNull();
  });
});
