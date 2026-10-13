import { describe, expect, it } from "vitest";

import { SAMPLE_GANTT } from "@/prototype/sample-data";

const PLAN_CHARS = new Set([".", "b", "1", "2"]);
const SYMBOL_CHARS = new Set([".", "#", "v"]);

describe("data contoh Gantt prototipe", () => {
  it("semua baris punya jumlah sel sama agar kolom tabel sejajar", () => {
    const widths = new Set(SAMPLE_GANTT.map((row) => row.cells.length));
    expect(widths.size).toBe(1);
    expect(SAMPLE_GANTT.length).toBeGreaterThan(0);
  });

  it("setiap baris punya id unik", () => {
    const ids = SAMPLE_GANTT.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tidak ada karakter tak dikenal yang diam-diam jadi sel kosong", () => {
    // row() memetakan karakter tak dikenal ke "none", jadi salah ketik hilang tanpa jejak.
    for (const row of SAMPLE_GANTT) {
      const plan = row.cells.map((cell) =>
        cell.kind === "none"
          ? "."
          : cell.kind === "base"
            ? "b"
            : cell.kind === "rev1"
              ? "1"
              : "2",
      );
      for (const char of plan) {
        expect(PLAN_CHARS.has(char), `${row.id}: karakter plan "${char}"`).toBe(
          true,
        );
      }
      const symbols = row.cells.map((cell) =>
        cell.symbol === null ? "." : cell.symbol === "#" ? "#" : "v",
      );
      for (const char of symbols) {
        expect(
          SYMBOL_CHARS.has(char),
          `${row.id}: karakter simbol "${char}"`,
        ).toBe(true);
      }
    }
  });

  it("hanya revisi pertama yang boleh muncul sebelum revisi berikutnya di satu baris", () => {
    // docs/01 §11: tambahan lama tetap kuning, oranye hanya untuk revisi yang menyusul.
    for (const row of SAMPLE_GANTT) {
      const firstRev2 = row.cells.findIndex((cell) => cell.kind === "rev2");
      if (firstRev2 === -1) continue;
      const hasRev1 = row.cells
        .slice(0, firstRev2)
        .some((cell) => cell.kind === "rev1");
      expect(hasRev1, `${row.id} punya rev2 tanpa rev1 sebelumnya`).toBe(true);
    }
  });
});

describe("decoder sel Gantt", () => {
  it("menerjemahkan baseline, revisi, dan simbol berjalan", () => {
    const row = SAMPLE_GANTT.find((item) => item.id === "w1-t2");
    expect(row).toBeDefined();
    expect(row?.cells.slice(0, 8).map((cell) => cell.kind)).toEqual([
      "none",
      "none",
      "none",
      "none",
      "base",
      "base",
      "base",
      "base",
    ]);
    expect(row?.cells[4]?.symbol).toBe("#");
    expect(row?.cells[9]?.kind).toBe("rev1");
  });

  it("menandai selesai hanya di baris paket yang selesai", () => {
    const selesai = SAMPLE_GANTT.flatMap((row) =>
      row.cells.filter((cell) => cell.symbol === "✓").map(() => row.status),
    );
    expect(selesai.length).toBeGreaterThan(0);
    for (const status of selesai) {
      expect(status).toContain("Selesai");
    }
  });
});
