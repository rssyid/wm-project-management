import { z } from "zod";

import { OPS } from "../location";

/**
 * Skema master dipakai bersama form klien dan route handler (docs/02 §1). Field yang boleh
 * diubah memakai `.partial()` pada skema update.
 */

const nameField = z.string().trim().min(1, "Nama wajib diisi.").max(120);
const codeField = z
  .string()
  .trim()
  .min(1, "Kode wajib diisi.")
  .max(30)
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Kode hanya huruf, angka, titik, garis, atau garis bawah.",
  );
const orderField = z.coerce.number().int().min(0).max(9999);
const idField = z.string().trim().min(1, "Pilih data terlebih dahulu.");

/**
 * Update menerima sebagian field plus `isActive`, sehingga menonaktifkan dan mengaktifkan
 * kembali memakai endpoint yang sama (docs/04 §2).
 */
function updateSchemaFor<T extends z.ZodObject>(schema: T) {
  return schema.partial().extend({ isActive: z.boolean().optional() });
}

export const regionSchema = z.object({
  code: codeField,
  name: nameField,
  ops: z.enum(OPS),
  order: orderField.optional(),
});
export const regionUpdateSchema = updateSchemaFor(regionSchema);

export const wilayahSchema = z.object({
  regionId: idField,
  name: nameField,
  order: orderField.optional(),
});
export const wilayahUpdateSchema = updateSchemaFor(wilayahSchema);

export const companySchema = z.object({
  code: codeField,
  name: nameField,
  order: orderField.optional(),
});
export const companyUpdateSchema = updateSchemaFor(companySchema);

export const estateSchema = z.object({
  companyId: idField,
  wilayahId: idField,
  code: codeField,
  name: nameField,
  estateNew: z.string().trim().max(30).optional().nullable(),
  legacyCode: z.string().trim().max(30).optional().nullable(),
  order: orderField.optional(),
});
export const estateUpdateSchema = updateSchemaFor(estateSchema);

export const blockSchema = z.object({
  estateId: idField,
  blockCode: codeField,
  name: nameField,
  plantingYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .nullable(),
  areaHectares: z
    .string()
    .trim()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      "Luas diisi angka dengan maksimal 2 desimal.",
    )
    .optional()
    .nullable(),
});
export const blockUpdateSchema = updateSchemaFor(blockSchema);

export const vendorSchema = z.object({
  name: nameField,
  type: z.enum(["EKSTERNAL", "INTERNAL"]).default("EKSTERNAL"),
  address: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z
    .email("Format email tidak valid.")
    .optional()
    .nullable()
    .or(z.literal("")),
  contactName: z.string().trim().max(120).optional().nullable(),
  npwp: z.string().trim().max(30).optional().nullable(),
});
export const vendorUpdateSchema = updateSchemaFor(vendorSchema);

export const unitSchema = z.object({
  code: codeField,
  name: nameField,
});
export const unitUpdateSchema = updateSchemaFor(unitSchema);

export const projectCategorySchema = z.object({
  code: codeField,
  name: nameField,
  order: orderField.optional(),
});
export const projectCategoryUpdateSchema = updateSchemaFor(
  projectCategorySchema,
);

export const materialSchema = z.object({
  name: nameField,
  defaultUnitId: idField,
  code: codeField.optional().nullable(),
});
export const materialUpdateSchema = updateSchemaFor(materialSchema);

export const heavyEquipmentTypeSchema = z.object({
  name: nameField,
});
export const heavyEquipmentTypeUpdateSchema = updateSchemaFor(
  heavyEquipmentTypeSchema,
);

export const approvalPositionSchema = z.object({
  code: codeField,
  name: nameField,
  rank: z.coerce.number().int().min(1).max(20),
});
export const approvalPositionUpdateSchema = updateSchemaFor(
  approvalPositionSchema,
);

/** Pembuatan cepat dari nama saja (docs/04 §2); isComplete tetap false. */
export const quickVendorSchema = z.object({
  name: nameField,
  type: z.enum(["EKSTERNAL", "INTERNAL"]).default("EKSTERNAL"),
});

export const quickMaterialSchema = z.object({
  name: nameField,
  defaultUnitId: idField,
});

export type RegionInput = z.infer<typeof regionSchema>;
export type WilayahInput = z.infer<typeof wilayahSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type EstateInput = z.infer<typeof estateSchema>;
export type BlockInput = z.infer<typeof blockSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type ProjectCategoryInput = z.infer<typeof projectCategorySchema>;
export type MaterialInput = z.infer<typeof materialSchema>;
export type HeavyEquipmentTypeInput = z.infer<typeof heavyEquipmentTypeSchema>;
export type ApprovalPositionInput = z.infer<typeof approvalPositionSchema>;
export type QuickVendorInput = z.infer<typeof quickVendorSchema>;
export type QuickMaterialInput = z.infer<typeof quickMaterialSchema>;
