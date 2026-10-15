import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  businessDateIso,
  calendarDaysBetween,
  compareBusinessDate,
  parseBusinessDate,
} from "@/shared/date";

describe("parseBusinessDate", () => {
  it("menghasilkan tengah malam UTC agar tidak bergeser sehari", () => {
    const date = parseBusinessDate("2026-10-14");
    expect(date.toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });

  it("menolak format dan tanggal yang tidak ada di kalender", () => {
    expect(() => parseBusinessDate("14/10/2026")).toThrow();
    expect(() => parseBusinessDate("2026-02-30")).toThrow();
    expect(() => parseBusinessDate("2026-10-14").valueOf()).not.toBeNaN();
  });
});

describe("businessDateIso", () => {
  it("membaca komponen lokal seperti driver pg", () => {
    expect(businessDateIso(new Date(2026, 9, 14))).toBe("2026-10-14");
  });
});

describe("perbandingan tanggal", () => {
  it("mengurutkan format yang sama panjang secara leksikografis", () => {
    expect(compareBusinessDate("2026-10-14", "2026-10-14")).toBe(0);
    expect(compareBusinessDate("2026-10-13", "2026-10-14")).toBe(-1);
    expect(compareBusinessDate("2026-10-15", "2026-10-14")).toBe(1);
  });
});

describe("calendarDaysBetween", () => {
  it("menghitung selisih hari kalender", () => {
    expect(calendarDaysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(calendarDaysBetween("2026-02-26", "2026-03-02")).toBe(4);
    expect(calendarDaysBetween("2026-10-08", "2026-10-01")).toBe(-7);
  });
});

describe("addCalendarDays", () => {
  it("melewati akhir bulan dan tahun", () => {
    expect(addCalendarDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
