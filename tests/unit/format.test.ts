import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDecimal,
  formatGanttDate,
  formatGanttWeek,
  formatPercent,
  formatRupiah,
} from "@/shared/format";

describe("formatDate", () => {
  it("formats as d MMM yyyy with Indonesian month names", () => {
    expect(formatDate(new Date("2026-10-10T03:00:00Z"))).toBe("10 Okt 2026");
  });

  it("uses Asia/Jakarta, so 17:00 UTC is already the next day", () => {
    expect(formatDate(new Date("2026-10-10T17:00:00Z"))).toBe("11 Okt 2026");
    expect(formatDate(new Date("2026-10-10T16:59:00Z"))).toBe("10 Okt 2026");
  });
});

describe("formatGanttDate", () => {
  it("D-29: formats as dd/mm/yy", () => {
    expect(formatGanttDate(new Date("2026-10-13T00:00:00+07:00"))).toBe(
      "13/10/26",
    );
    expect(formatGanttDate(new Date("2026-08-03T00:00:00+07:00"))).toBe(
      "03/08/26",
    );
  });

  it("D-29: uses Asia/Jakarta, so 17:00 UTC is already the next day", () => {
    expect(formatGanttDate(new Date("2026-10-10T17:00:00Z"))).toBe("11/10/26");
  });
});

describe("formatGanttWeek", () => {
  it("D-29: formats as dd/mm without the year", () => {
    expect(formatGanttWeek(new Date("2026-10-12T00:00:00+07:00"))).toBe(
      "12/10",
    );
    expect(formatGanttWeek(new Date("2026-08-03T00:00:00+07:00"))).toBe(
      "03/08",
    );
  });
});

describe("formatRupiah", () => {
  it("uses Rp prefix without space and dot thousands separator", () => {
    expect(formatRupiah("1250000000")).toBe("Rp1.250.000.000");
  });

  it("keeps Decimal strings exact beyond float precision", () => {
    expect(formatRupiah("9007199254740993")).toBe("Rp9.007.199.254.740.993");
  });
});

describe("formatDecimal", () => {
  it("rounds to one decimal with a comma", () => {
    expect(formatDecimal("12.34")).toBe("12,3");
    expect(formatDecimal("0")).toBe("0,0");
  });
});

describe("formatPercent", () => {
  it("uses comma decimal separator and one decimal place", () => {
    expect(formatPercent("65.4")).toBe("65,4%");
    expect(formatPercent(100)).toBe("100,0%");
  });
});
