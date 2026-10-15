import { z } from "zod";

import {
  idField,
  nameField,
  optionalBusinessDateField,
  optionalMoneyField,
  optionalTextField,
} from "./fields";

/** Satu baris lokasi proyek: Estate milik Company proyek, Block opsional satu Estate (D-15, D-16). */
export const projectEstateSchema = z.object({
  estateId: idField,
  blockId: z.string().trim().min(1).optional().nullable(),
  isPrimary: z.boolean(),
});

/** docs/01 §3: minimal satu Estate dan tepat satu Estate utama. */
const estatesField = z
  .array(projectEstateSchema)
  .min(1, "Pilih minimal satu Estate.")
  .refine(
    (estates) => estates.filter((estate) => estate.isPrimary).length === 1,
    "Tepat satu Estate ditandai sebagai utama.",
  );

/** Target selesai tidak boleh mendahului target mulai; dipakai form dan API. */
export function projectDatesInOrder(
  value: { targetStartDate?: string | null; targetEndDate?: string | null },
  ctx: z.RefinementCtx,
) {
  const start = value.targetStartDate;
  const end = value.targetEndDate;
  if (start && end && end < start) {
    ctx.addIssue({
      code: "custom",
      path: ["targetEndDate"],
      message: "Target selesai tidak boleh lebih awal dari target mulai.",
    });
  }
}

export const createProjectSchema = z
  .object({
    name: nameField,
    companyId: idField,
    categoryId: idField,
    description: optionalTextField(2000),
    picUserId: z.string().trim().min(1).optional().nullable(),
    targetStartDate: optionalBusinessDateField,
    targetEndDate: optionalBusinessDateField,
    plannedBudget: optionalMoneyField,
    estates: estatesField,
  })
  .superRefine(projectDatesInOrder);

export const updateProjectSchema = z
  .object({
    version: z.number().int().min(1),
    name: nameField.optional(),
    description: optionalTextField(2000),
    picUserId: z.string().trim().min(1).optional().nullable(),
    targetStartDate: optionalBusinessDateField,
    targetEndDate: optionalBusinessDateField,
    plannedBudget: optionalMoneyField,
  })
  .superRefine(projectDatesInOrder);

/**
 * Field proyek yang dipakai form. Form menambah Region dan Estate utama (AC-11), memakai daftar
 * Estate tanpa `isPrimary` (ditentukan dari pilihan radio), dan membolehkan PIC kosong sebagai
 * string kosong karena `<select>` tidak punya nilai null. Konversi ke null terjadi saat submit.
 */
export const projectFormShape = {
  ...createProjectSchema.shape,
  picUserId: z.string().trim().optional().nullable(),
  regionId: z.string().min(1, "Pilih Region."),
  primaryEstateId: z.string().min(1, "Pilih Estate utama."),
  estates: z
    .array(z.object({ estateId: z.string().min(1), blockId: z.string() }))
    .min(1, "Pilih minimal satu Estate."),
};

export const replaceProjectEstatesSchema = z.object({
  version: z.number().int().min(1),
  estates: estatesField,
});

/** Filter daftar proyek (docs/04 §3); `archived` diterima sejak F2 tetapi menyaring baru aktif di F6. */
export const projectFiltersSchema = z.object({
  status: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : [])),
  companyIds: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : [])),
  regionIds: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : [])),
  wilayahIds: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : [])),
  estateIds: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : [])),
  categoryId: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectEstateInput = z.infer<typeof projectEstateSchema>;
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;
