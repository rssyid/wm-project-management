import { z } from "zod";

import { idField, moneyField, nameField, optionalMoneyField } from "./fields";

/**
 * Satu tier = satu rentang nominal dengan urutan jabatan (maks. 9). Rentang aktif per jenis
 * dokumen tidak boleh tumpang tindih atau berlubang; itu dijaga service karena butuh
 * membaca tier lain (docs/01 §6).
 */
const tierShape = {
  name: nameField,
  forAfce: z.boolean(),
  forArSupplement: z.boolean(),
  minAmount: moneyField,
  maxAmount: optionalMoneyField,
  positionIds: z.array(idField).min(1, "Isi minimal satu jabatan.").max(9),
};

export const createApprovalTierSchema = z
  .object(tierShape)
  .refine((value) => value.forAfce || value.forArSupplement, {
    message: "Pilih minimal AFCE atau AR tambahan.",
    path: ["forAfce"],
  })
  .refine(
    (value) =>
      value.maxAmount === undefined ||
      value.maxAmount === null ||
      value.maxAmount === "" ||
      Number(value.maxAmount) > Number(value.minAmount),
    {
      message: "Batas atas harus lebih besar dari batas bawah.",
      path: ["maxAmount"],
    },
  )
  .refine(
    (value) => new Set(value.positionIds).size === value.positionIds.length,
    { message: "Jabatan tidak boleh sama dalam satu tier.", path: ["positionIds"] },
  );

export const updateApprovalTierSchema = createApprovalTierSchema.extend({
  version: z.number().int().min(1),
  isActive: z.boolean().optional(),
});

/** docs/04 §2: `doc=AFCE|AR&amount=` mengembalikan tier yang cocok, 409 bila tidak ada. */
export const approvalTierMatchSchema = z.object({
  doc: z.enum(["AFCE", "AR"]),
  amount: moneyField,
});

export type CreateApprovalTierInput = z.infer<typeof createApprovalTierSchema>;
export type UpdateApprovalTierInput = z.infer<typeof updateApprovalTierSchema>;