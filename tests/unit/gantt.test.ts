import { describe, expect, it } from "vitest";

import {
  cellColorFor,
  cellSymbolFor,
  inRange,
  mondayOf,
  addWeeks,
  weekLabel,
} from "@/domain/gantt/queries";
import { decimal } from "@/infra/decimal";

describe("AC-53 Gantt W1 dan attempt termasuk batal", () => {
  it("W1 adalah Senin minggu tanggal terbalik dari semua tanggal jadwal", () => {
    // Senin 12 Okt 2026 adalah awal minggu untuk tanggal 14 Okt 2026 (Rabu)
    expect(mondayOf("2026-10-14")).toBe("2026-10-12");
    // Minggu 18 Okt 2026 (Minggu) → Senin 12 Okt 2026
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
  });

  it("addWeeks menambah tepat n minggu", () => {
    expect(addWeeks("2026-10-12", 0)).toBe("2026-10-12");
    expect(addWeeks("2026-10-12", 1)).toBe("2026-10-19");
    expect(addWeeks("2026-10-12", 2)).toBe("2026-10-26");
  });

  it("weekLabel menampilkan dd/mm tanpa tahun", () => {
    expect(weekLabel("2026-10-12")).toBe("12/10");
  });
});

describe("AC-54 warna sel Gantt", () => {
  const baseline = { start: "2026-10-12", end: "2026-10-18" };
  const rev1 = { start: "2026-10-19", end: "2026-10-25", revisionNo: 1 };
  const rev2 = { start: "2026-10-26", end: "2026-11-01", revisionNo: 2 };

  it("minggu dalam baseline → warna abu-abu (base)", () => {
    expect(cellColorFor("2026-10-12", baseline, [])).toBe("base");
    expect(cellColorFor("2026-10-18", baseline, [])).toBe("base");
  });

  it("minggu di luar baseline → null", () => {
    expect(cellColorFor("2026-10-05", baseline, [])).toBeNull();
    expect(cellColorFor("2026-10-26", baseline, [])).toBeNull();
  });

  it("revisi pertama → warna kuning (rev1)", () => {
    expect(cellColorFor("2026-10-19", baseline, [rev1])).toBe("rev1");
  });

  it("revisi berikutnya → warna oranye (rev2)", () => {
    expect(cellColorFor("2026-10-26", baseline, [rev1, rev2])).toBe("rev2");
  });

  it("revisi menimpa baseline pada overlapping range", () => {
    expect(cellColorFor("2026-10-19", baseline, [rev1])).toBe("rev1");
  });
});

describe("AC-55 simbol Gantt", () => {
  it("tenderAttempt: # sejak actualStart", () => {
    expect(
      cellSymbolFor("tenderAttempt", "2026-10-12", "2026-10-12", null, null),
    ).toBe("#");
    expect(
      cellSymbolFor("tenderAttempt", "2026-10-05", "2026-10-12", null, null),
    ).toBeNull();
  });

  it("physical: ✓ saat progres 100% dan minggu >= actualEnd", () => {
    expect(
      cellSymbolFor(
        "physical",
        "2026-10-26",
        "2026-10-12",
        "2026-10-25",
        decimal("100"),
      ),
    ).toBe("✓");
    expect(
      cellSymbolFor(
        "physical",
        "2026-10-19",
        "2026-10-12",
        "2026-10-25",
        decimal("100"),
      ),
    ).toBeNull();
  });

  it("workPackage: # sejak purchaseRequest, ✓ setelah completedDate", () => {
    expect(
      cellSymbolFor("workPackage", "2026-10-12", "2026-10-12", null, null),
    ).toBe("#");
    expect(
      cellSymbolFor(
        "workPackage",
        "2026-10-26",
        "2026-10-12",
        "2026-10-25",
        null,
      ),
    ).toBe("✓");
  });

  it("simbol tidak mengganti warna (cellColorFor tetap berfungsi)", () => {
    const baseline = { start: "2026-10-12", end: "2026-10-18" };
    expect(cellColorFor("2026-10-12", baseline, [])).toBe("base");
    expect(
      cellSymbolFor("tenderAttempt", "2026-10-12", "2026-10-12", null, null),
    ).toBe("#");
  });
});

describe("inRange helper", () => {
  it("mengembalikan true bila minggu di dalam range", () => {
    expect(inRange("2026-10-12", "2026-10-12", "2026-10-18")).toBe(true);
    expect(inRange("2026-10-18", "2026-10-12", "2026-10-18")).toBe(true);
  });

  it("mengembalikan false bila minggu di luar range", () => {
    expect(inRange("2026-10-05", "2026-10-12", "2026-10-18")).toBe(false);
    expect(inRange("2026-10-26", "2026-10-12", "2026-10-18")).toBe(false);
  });
});
