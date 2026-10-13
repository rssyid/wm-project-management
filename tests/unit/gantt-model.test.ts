import { describe, expect, it } from "vitest";

import { currentWeekIndex, outlineNumbers } from "@/prototype/gantt-model";

// 2026-08-03 adalah Senin (W1). Offset dalam milidetik sejak anchor tersebut.
const DAY = 86_400_000;
const at = (dayOffset: number, hour = 9) =>
  Date.parse("2026-08-03T00:00:00+07:00") + dayOffset * DAY + hour * 3_600_000;

describe("outlineNumbers", () => {
  it("D-31: jenjang 0 memakai #", () => {
    expect(outlineNumbers([0, 0])).toEqual(["#", "#"]);
  });

  it("D-31: jenjang 1 memakai angka berurutan", () => {
    expect(outlineNumbers([1, 1, 1])).toEqual(["1", "2", "3"]);
  });

  it("D-31: jenjang 2 memakai huruf yang mengulang di setiap anak jenjang 1", () => {
    expect(outlineNumbers([1, 2, 2, 2, 2, 1, 2])).toEqual([
      "1",
      "a",
      "b",
      "c",
      "d",
      "2",
      "a",
    ]);
  });

  it("D-31: kombinasi jenjang mengikuti urutan baris Gantt", () => {
    // Susunan baris pada prototype: proyek, pekerjaan 1 + empat anaknya, pekerjaan 2 + anaknya.
    expect(outlineNumbers([0, 1, 2, 2, 2, 2, 1, 2])).toEqual([
      "#",
      "1",
      "a",
      "b",
      "c",
      "d",
      "2",
      "a",
    ]);
  });
});

describe("currentWeekIndex", () => {
  it("menghitung W1 pada hari pertama jadwal", () => {
    expect(currentWeekIndex("2026-08-03", at(0))).toBe(1);
  });

  it("mempertahankan indeks yang sama sepanjang minggu", () => {
    expect(currentWeekIndex("2026-08-03", at(0, 0))).toBe(1);
    expect(currentWeekIndex("2026-08-03", at(6, 23))).toBe(1);
    expect(currentWeekIndex("2026-08-03", at(7, 0))).toBe(2);
  });

  it("menghitung W11 pada 13 Oktober 2026", () => {
    // Anchor 03/08 = W1.-offset 70 hari = 12/10, jadi 13 Okt masih di minggu ke-11
    // dan 19/10 sudah masuk minggu ke-12.
    expect(currentWeekIndex("2026-08-03", at(71, 9))).toBe(11);
    expect(currentWeekIndex("2026-08-03", at(76, 23))).toBe(11);
    expect(currentWeekIndex("2026-08-03", at(77, 0))).toBe(12);
  });

  it("mengembalikan null kalau jadwal belum mulai", () => {
    expect(currentWeekIndex("2026-08-03", at(-1))).toBeNull();
    expect(currentWeekIndex("2026-08-03", at(-400))).toBeNull();
  });

  it("mengembalikan null untuk anchor yang tidak valid", () => {
    expect(currentWeekIndex("bukan-tanggal", at(0))).toBeNull();
  });
});
