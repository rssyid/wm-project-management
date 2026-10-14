import { readFile } from "node:fs/promises";
import path from "node:path";

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

  it("D-36: baris pekerjaan tidak membawa bar baseline", () => {
    // docs/01 §4: hanya tender attempt, fisik, dan Paket Kerja yang punya baseline.
    // Baris pengelompok (proyek, pekerjaan) tidak boleh menampilkan bar; bar proyek
    // adalah roll-up rentang anak-anaknya.
    for (const row of SAMPLE_GANTT) {
      if (row.depth !== 1) continue;
      expect(
        row.cells.every((cell) => cell.kind === "none"),
        `${row.id} (jenjang 1) seharusnya tanpa bar`,
      ).toBe(true);
      expect(
        row.cells.every((cell) => cell.symbol === null),
        `${row.id} (jenjang 1) seharusnya tanpa simbol`,
      ).toBe(true);
    }
  });

  it("D-36: baris proyek tetap menampilkan roll-up rentang", () => {
    const proyek = SAMPLE_GANTT.find((row) => row.depth === 0);
    expect(proyek).toBeDefined();
    expect(proyek?.cells.some((cell) => cell.kind === "base")).toBe(true);
  });

  it("D-27: simbol hanya di atas sel berwarna (invariant)", () => {
    // Simbol duduk di dalam sel bar, jadi sel tanpa rencana tidak boleh memuat simbol.
    // Pergeseran satu karakter pada notasi plan/symbols akan melanggar ini.
    for (const row of SAMPLE_GANTT) {
      row.cells.forEach((cell, index) => {
        if (cell.symbol !== null) {
          expect(
            cell.kind,
            `${row.id} minggu ${index + 1} punya simbol tanpa warna`,
          ).not.toBe("none");
        }
      });
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

describe("decode sel Gantt", () => {
  it("menerjemahkan baseline, revisi, dan simbol berjalan", () => {
    // Tender #2: W1-W5 kosong, W6-W9 abu-abu dengan #, W10-W11 kuning tanpa simbol.
    const row = SAMPLE_GANTT.find((item) => item.id === "w1-t2");
    expect(row).toBeDefined();
    expect(row?.cells.slice(0, 11).map((cell) => cell.kind)).toEqual([
      "none",
      "none",
      "none",
      "none",
      "none",
      "base",
      "base",
      "base",
      "base",
      "rev1",
      "rev1",
    ]);
    expect(row?.cells[6]?.symbol).toBe("#");
    expect(row?.cells[9]?.symbol).toBeNull();
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

describe("pewarnaan Gantt", () => {
  it("D-27: kelas pewarnaan tidak memuat pola garis", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/prototype/gantt.tsx"),
      "utf8",
    );
    expect(source).not.toContain("gantt-stripes");
  });

  it("D-27: utilitas pola garis sudah dihapus dari globals.css", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(source).not.toContain("gantt-stripes");
  });

  it("D-35: garis merah memakai token Gantt, bukan --ews-red", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/prototype/gantt.tsx"),
      "utf8",
    );
    expect(source).toContain("border-r-gantt-edge");
    // `border-ews-red` memberi warna keempat sisi dan menurunkan kontras badge EWS
    // (rgb(255 0 0) di atas #FBE9E7 hanya 4,1:1, gagal AA).
    expect(source).not.toContain("border-ews-red");
    expect(source).not.toMatch(/[\s"]border-ews-red[\s"]/);
  });

  it("D-35: token gantt-edge memakai rgb(255 0 0)", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(source).toMatch(/--gantt-edge:\s*rgb\(255\s+0\s+0\)/);
    expect(source).toContain("--color-gantt-edge: var(--gantt-edge)");
  });

  it("sel kosong pada minggu berjalan tidak diberi warna latar", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/prototype/gantt.tsx"),
      "utf8",
    );
    expect(source).not.toContain("bg-canal-soft");
  });
});
