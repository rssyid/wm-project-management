import { describe, expect, it } from "vitest";

import { surveyFormSchema, surveySchema } from "@/shared/schemas/survey";

const formValues = {
  version: 1,
  surveyDate: "2026-10-05",
  surveyorNames: "Siti Rahma",
  existingCondition: "Saluran tersumbat sedimen",
  recommendation: "Pembersihan sedimen",
  latitude: "-3.123456",
  longitude: "102.654321",
  notes: "",
};

describe("surveyFormSchema (D-58)", () => {
  it("bisa disusun tanpa .omit() sehingga tidak melempar saat modul klien dimuat", () => {
    expect(() => surveyFormSchema.parse(formValues)).not.toThrow();
  });

  it("tidak meminta daftar berkas karena dikelola komponen unggah", () => {
    const result = surveyFormSchema.safeParse(formValues);
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("photoFileIds");
  });

  it("AC-14 tetap menolak lintang tanpa bujur", () => {
    const result = surveyFormSchema.safeParse({
      ...formValues,
      longitude: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(
      "latitude dan longitude sekaligus",
    );
  });

  it("menerima koordinat yang dikosongkan bersama", () => {
    expect(
      surveyFormSchema.safeParse({
        ...formValues,
        latitude: "",
        longitude: "",
      }).success,
    ).toBe(true);
  });
});

describe("surveySchema", () => {
  it("memberi nilai awal daftar berkas kosong", () => {
    const result = surveySchema.parse(formValues);
    expect(result.photoFileIds).toEqual([]);
    expect(result.documentFileIds).toEqual([]);
    expect(result.spatialFileIds).toEqual([]);
  });

  it("menolak kondisi eksisting yang kosong", () => {
    const result = surveySchema.safeParse({
      ...formValues,
      existingCondition: "   ",
    });
    expect(result.success).toBe(false);
  });
});
