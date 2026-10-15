import { describe, expect, it } from "vitest";

import { isMoneyAmount, isPositiveMoney } from "@/shared/money";

describe("isMoneyAmount", () => {
  it("hanya menerima digit dengan maksimal dua desimal", () => {
    expect(isMoneyAmount("1250000.10")).toBe(true);
    expect(isMoneyAmount("1250000")).toBe(true);
    expect(isMoneyAmount("1250000.123")).toBe(false);
    expect(isMoneyAmount("1.250.000")).toBe(false);
    expect(isMoneyAmount("-50")).toBe(false);
  });
});

describe("isPositiveMoney", () => {
  it("menolak nominal nol untuk AR tambahan", () => {
    expect(isPositiveMoney("0")).toBe(false);
    expect(isPositiveMoney("0.00")).toBe(false);
    expect(isPositiveMoney("0.01")).toBe(true);
    expect(isPositiveMoney("1500000.00")).toBe(true);
  });
});
