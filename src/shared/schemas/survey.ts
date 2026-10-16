import { z } from "zod";

import { businessDateField, idField, optionalTextField } from "./fields";

/**
 * Survei (docs/01 §1): tanggal, surveyor, kondisi eksisting, rekomendasi, koordinat opsional.
 * Foto, dokumen, dan data spasial menempel lewat FileObject dan dicatat di `fileIds`.
 *
 * Bentuk isian (`surveyFormShape`) dan aturan koordinat (`surveyCoordinatesRule`) dipisah dari
 * `surveySchema` supaya form klien bisa memakai bagian isian tanpa `.omit()`; Zod 4 melarang
 * `.omit()`/`.pick()`/`.extend()` pada skema yang sudah punya refinement (D-58).
 */
const optionalNumberField = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || /^-?\d{1,3}(\.\d{1,6})?$/.test(value),
    "Isi koordinat dengan angka dan maksimal enam desimal.",
  )
  .optional()
  .nullable();

export const surveyFormShape = {
  version: z.number().int().min(1),
  surveyDate: businessDateField,
  surveyorNames: z
    .string()
    .trim()
    .min(1, "Nama surveyor wajib diisi.")
    .max(200),
  existingCondition: z
    .string()
    .trim()
    .min(1, "Kondisi eksisting wajib diisi.")
    .max(4000),
  recommendation: optionalTextField(2000),
  latitude: optionalNumberField,
  longitude: optionalNumberField,
  notes: optionalTextField(2000),
};

/** Lintang dan bujur harus diisi bersama atau dikosongkan bersama. */
export function surveyCoordinatesRule(
  value: { latitude?: string | null; longitude?: string | null },
  ctx: z.RefinementCtx,
) {
  const hasCoordinate =
    (value.latitude?.length ?? 0) > 0 || (value.longitude?.length ?? 0) > 0;
  if (hasCoordinate && !(value.latitude && value.longitude)) {
    ctx.addIssue({
      code: "custom",
      path: ["latitude"],
      message: "Isi latitude dan longitude sekaligus, atau kosongkan keduanya.",
    });
  }
}

export const surveySchema = z
  .object({
    ...surveyFormShape,
    photoFileIds: z.array(idField).max(20).default([]),
    documentFileIds: z.array(idField).max(10).default([]),
    spatialFileIds: z.array(idField).max(5).default([]),
  })
  .superRefine(surveyCoordinatesRule);

/** Skema form klien: isian saja, tanpa daftar berkas yang dikelola komponen unggah. */
export const surveyFormSchema = z
  .object(surveyFormShape)
  .superRefine(surveyCoordinatesRule);

export type SurveyInput = z.infer<typeof surveySchema>;
export type SurveyFormValues = z.infer<typeof surveyFormSchema>;
