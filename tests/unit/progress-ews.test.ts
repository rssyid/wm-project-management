import { describe, expect, it } from "vitest";

import {
  packageProgress,
  plannedPercent,
  projectProgress,
  workItemProgress,
  assertPackageWeights,
  assertProjectWeights,
  assertWorkItemWeights,
  computeEws,
  ewsLevel,
  freezeDays,
  isFrozenProjectStatus,
} from "@/domain/progress-ews/service";
import { decimal } from "@/infra/decimal";

describe("AC-49 progres paket dan Pekerjaan", () => {
  it("progres paket = rata-rata per item min(diterima/rencana, 1) x 100", () => {
    const result = packageProgress([
      { plannedQty: decimal("50"), deliveredQty: decimal("20") },
      { plannedQty: decimal("100"), deliveredQty: decimal("100") },
    ]);
    expect(result.toFixed(2)).toBe("70.00");
  });

  it("kiriman melebihi rencana tidak melebihi 100%", () => {
    const result = packageProgress([
      { plannedQty: decimal("50"), deliveredQty: decimal("80") },
    ]);
    expect(result.toFixed(2)).toBe("100.00");
  });

  it("paket tanpa item = 0%", () => {
    expect(packageProgress([]).toFixed(2)).toBe("0.00");
  });
});

describe("AC-49 progres Pekerjaan", () => {
  it("fisik x wFisik/100 + paket x w/100", () => {
    const result = workItemProgress({
      physicalPct: decimal("50"),
      materialPct: decimal("50"),
      physicalProgressPct: decimal("70"),
      packageProgresses: [decimal("100"), decimal("40")],
    });
    // fisikPart = 70*50/100 = 35; materialPart = (100+40)*50/100 = 70; total = 105
    expect(result.toFixed(2)).toBe("105.00");
  });

  it("PURCHASE tanpa paket progres = progres fisik saja", () => {
    const result = workItemProgress({
      physicalPct: decimal("0"),
      materialPct: decimal("100"),
      physicalProgressPct: decimal("0"),
      packageProgresses: [decimal("75")],
    });
    expect(result.toFixed(2)).toBe("75.00");
  });
});

describe("AC-49 progres proyek contoh 65,4%", () => {
  it("A 59,0% @60 + B 75,0% @40 = 65,4%", () => {
    const result = projectProgress([
      { projectWeightPct: decimal("60"), progressPct: decimal("59") },
      { projectWeightPct: decimal("40"), progressPct: decimal("75") },
    ]);
    expect(result.toFixed(2)).toBe("65.40");
  });
});

describe("AC-50 rencana linear hari kerja dari baseline awal", () => {
  const base = {
    baselineStartIso: "2026-10-01",
    baselineEndIso: "2026-10-15",
    targetIso: "2026-10-08",
    workingWeekdays: [1, 2, 3, 4, 5, 6] as const,
    holidays: [],
    frozenDays: [],
  };

  it("hitung hari kerja Senin-Sabtu (1-15 Oktober = 13 hari kerja; target 8 = 7)", () => {
    const result = plannedPercent(base);
    expect(result.toFixed(2)).toBe("53.85");
  });

  it("libur mengurangi total hari kerja", () => {
    const result = plannedPercent({
      ...base,
      holidays: ["2026-10-03"], // Sabtu libur
    });
    // total 12, target 6 (1,2,5,6,7,8) = 50.00
    expect(result.toFixed(2)).toBe("50.00");
  });

  it("target melebihi baseline end = 100%", () => {
    const result = plannedPercent({
      ...base,
      targetIso: "2026-10-30",
    });
    expect(result.toFixed(2)).toBe("100.00");
  });

  it("target sebelum baseline start = 0%", () => {
    const result = plannedPercent({
      ...base,
      targetIso: "2026-09-20",
    });
    expect(result.toFixed(2)).toBe("0.00");
  });

  it("hari kerja nol = 0%", () => {
    const result = plannedPercent({
      baselineStartIso: "2026-10-01",
      baselineEndIso: "2026-10-01",
      targetIso: "2026-10-01",
      workingWeekdays: [7],
      holidays: [],
      frozenDays: [],
    });
    expect(result.toFixed(2)).toBe("0.00");
  });
});

describe("AC-51 ambang EWS", () => {
  const standard = {
    yellowFrom: decimal("5"),
    redAbove: decimal("10"),
  };

  it("deviasi < 5 hijau", () => {
    expect(ewsLevel({ deviationPct: decimal("4"), ...standard }).level).toBe(
      "GREEN",
    );
  });

  it("deviasi 5–10 kuning", () => {
    expect(ewsLevel({ deviationPct: decimal("5"), ...standard }).level).toBe(
      "YELLOW",
    );
    expect(ewsLevel({ deviationPct: decimal("10"), ...standard }).level).toBe(
      "YELLOW",
    );
  });

  it("deviasi > 10 merah", () => {
    expect(
      ewsLevel({ deviationPct: decimal("10.01"), ...standard }).level,
    ).toBe("RED");
  });

  it("computeEws nilai string dua desimal", () => {
    const result = computeEws({
      plannedPct: decimal("40"),
      actualPct: decimal("50"),
      ...standard,
    });
    expect(result.level).toBe("YELLOW");
    expect(result.label).toBe("Kuning");
    expect(result.deviationPct).toBe("10.00");
    expect(result.plannedPct).toBe("40.00");
    expect(result.actualPct).toBe("50.00");
  });

  it("ubah ambang langsung berlaku (5 → 3, 10 → 7; deviasi 8 = merah)", () => {
    const result = ewsLevel({
      deviationPct: decimal("8"),
      yellowFrom: decimal("3"),
      redAbove: decimal("7"),
    });
    expect(result.level).toBe("RED");
  });
});

describe("AC-52 freeze ON_HOLD dan JEDA_SPK_BATAL", () => {
  const base = {
    baselineStartIso: "2026-10-01",
    baselineEndIso: "2026-10-15",
    targetIso: "2026-10-08",
    workingWeekdays: [1, 2, 3, 4, 5, 6] as const,
    holidays: [],
    frozenDays: [],
  };

  it("tanpa freeze: 53,85%", () => {
    expect(plannedPercent(base).toFixed(2)).toBe("53.85");
  });

  it("freeze 2 hari kerja di luar target (deviasi tidak bertambah)", () => {
    const frozen = freezeDays([{ fromIso: "2026-10-12", toIso: "2026-10-13" }]);
    expect(frozen).toEqual(["2026-10-12", "2026-10-13"]);
    const result = plannedPercent({ ...base, frozenDays: frozen });
    // total 11 (13-2), target masih 7 → 63.64
    expect(result.toFixed(2)).toBe("63.64");
  });

  it("isFrozenProjectStatus hanya ON_HOLD", () => {
    expect(isFrozenProjectStatus("ON_HOLD")).toBe(true);
    expect(isFrozenProjectStatus("EXECUTION")).toBe(false);
    expect(isFrozenProjectStatus("PROCUREMENT")).toBe(false);
    expect(isFrozenProjectStatus("WAITING_BAST")).toBe(false);
  });
});

describe("validasi bobot", () => {
  it("assertProjectWeights lolos bila total = 100", () => {
    expect(() =>
      assertProjectWeights([
        { projectWeightPct: decimal("60") },
        { projectWeightPct: decimal("40") },
      ]),
    ).not.toThrow();
  });

  it("assertProjectWeights gagal bila total != 100", () => {
    expect(() =>
      assertProjectWeights([
        { projectWeightPct: decimal("60") },
        { projectWeightPct: decimal("30") },
      ]),
    ).toThrow();
  });

  it("assertWorkItemWeights lolos bila fisik + material = 100", () => {
    expect(() =>
      assertWorkItemWeights(decimal("70"), decimal("30")),
    ).not.toThrow();
  });

  it("assertWorkItemWeights gagal bila fisik + material != 100", () => {
    expect(() => assertWorkItemWeights(decimal("70"), decimal("40"))).toThrow();
  });

  it("assertPackageWeights lolos bila total paket = bobot material", () => {
    expect(() =>
      assertPackageWeights(decimal("50"), [
        { weightPct: decimal("30") },
        { weightPct: decimal("20") },
      ]),
    ).not.toThrow();
  });

  it("assertPackageWeights gagal bila total paket != bobot material", () => {
    expect(() =>
      assertPackageWeights(decimal("50"), [
        { weightPct: decimal("40") },
        { weightPct: decimal("20") },
      ]),
    ).toThrow();
  });
});
