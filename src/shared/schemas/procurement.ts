import { z } from "zod";

import {
  businessDateField,
  idField,
  moneyField,
  optionalBusinessDateField,
  optionalMoneyField,
  optionalTextField,
  reasonField,
} from "./fields";

const qtyField = z
  .string()
  .trim()
  .refine(
    (value) => /^-?\d{1,13}(\.\d{1,3})?$/.test(value.trim()),
    "Isi kuantitas dengan angka maksimal tiga desimal (boleh negatif untuk koreksi).",
  );

/** Baris item Paket Kerja: material, satuan, qty rencana (docs/01 §9). */
export const workPackageItemSchema = z.object({
  materialId: idField,
  unitId: idField,
  plannedQty: qtyField,
});

/** Daftar bobot semua Pekerjaan aktif per proyek: tepat 100,00 (AC-31). */
export const workItemWeightRowSchema = z.object({
  workItemId: idField,
  projectWeightPct: moneyField,
});

/** Bobot paket per Pekerjaan untuk redistribusi saat pembatalan paket (AC-32). */
export const workPackageWeightRowSchema = z.object({
  workPackageId: idField,
  weightPct: moneyField,
});

export const putWorkItemWeightsSchema = z.object({
  version: z.number().int().min(1),
  weights: z
    .array(workItemWeightRowSchema)
    .min(1, "Pilih minimal satu Pekerjaan."),
});

/** Bobot fisik dan material per Pekerjaan: total 100 (AC-31). */
export const workItemWeightSchema = z.object({
  version: z.number().int().min(1),
  physicalWeightPct: moneyField,
  materialWeightPct: moneyField,
});

/** Membuat Pekerjaan baru; ≥ AFCE_AR_APPROVED; bobot semua aktif = 100,00 (AC-30, AC-31). */
export const createWorkItemSchema = z.object({
  name: z.string().trim().min(1, "Nama Pekerjaan wajib diisi.").max(160),
  type: z.enum(["TENDER_CONTRACT", "SWAKELOLA", "PURCHASE"]),
  projectWeightPct: moneyField,
  physicalWeightPct: moneyField,
  materialWeightPct: moneyField,
  targetVolume: optionalTextField(60),
  unitId: z.string().trim().min(1).optional().nullable(),
});

/** Ubah Pekerjaan: fisik + material = 100. */
export const updateWorkItemSchema = z.object({
  version: z.number().int().min(1),
  name: z
    .string()
    .trim()
    .min(1, "Nama Pekerjaan wajib diisi.")
    .max(160)
    .optional(),
  type: z.enum(["TENDER_CONTRACT", "SWAKELOLA", "PURCHASE"]).optional(),
  projectWeightPct: moneyField.optional(),
  physicalWeightPct: moneyField.optional(),
  materialWeightPct: moneyField.optional(),
  targetVolume: optionalTextField(60),
  unitId: z.string().trim().min(1).optional().nullable(),
});

/** Batal Pekerjaan atau Paket Kerja wajib alasan + bobot pengganti (AC-32). */
export const cancelWithWeightsSchema = z.object({
  version: z.number().int().min(1),
  reason: reasonField,
  weights: z.array(workItemWeightRowSchema).min(1),
});

/** USPK: nomor dan tanggal (docs/01 §7). */
export const createUspkSchema = z.object({
  number: z.string().trim().min(1, "Nomor USPK wajib diisi.").max(60),
  date: businessDateField,
});

/** Buat tender attempt: USPK baru + plan tender + plan fisik; baseline dikunci (AC-34, AC-35). */
export const createTenderAttemptSchema = z.object({
  uspk: createUspkSchema,
  planTender: optionalTextField(2000),
  planPhysical: optionalTextField(2000),
});

/** Catat pemenang: vendorId existing atau vendorName baru (AC-36). */
export const setTenderWinnerSchema = z.object({
  vendorId: z.string().trim().min(1).optional(),
  vendorName: z.string().trim().min(1).max(160).optional(),
});

/** Batal tender attempt: tanggal + alasan (docs/04 §5). */
export const cancelTenderAttemptSchema = z.object({
  cancelledDate: businessDateField,
  cancelReason: reasonField,
});

/** SPK: nomor, tanggal, vendor, nilai, tanggal release (docs/05 §7). */
export const createSpkSchema = z.object({
  number: z.string().trim().min(1, "Nomor SPK wajib diisi.").max(60),
  date: businessDateField,
  vendorId: idField,
  value: optionalMoneyField,
  releasedDate: optionalBusinessDateField,
});

/** Ubah SPK (hanya DRAFT). */
export const updateSpkSchema = z.object({
  version: z.number().int().min(1),
  number: z.string().trim().min(1, "Nomor SPK wajib diisi.").max(60).optional(),
  date: optionalBusinessDateField,
  vendorId: idField.optional(),
  value: optionalMoneyField,
  releasedDate: optionalBusinessDateField,
});

/** Release SPK: tanggal release (docs/04 §5). */
export const releaseSpkSchema = z.object({
  releasedDate: businessDateField,
});

/** Batal SPK: tanggal + alasan (docs/04 §5). */
export const cancelSpkSchema = z.object({
  cancelledDate: businessDateField,
  cancelReason: reasonField,
});

/** Buat Paket Kerja: item + bobot semua paket aktif = bobot material Pekerjaan (AC-31). */
export const createWorkPackageSchema = z.object({
  name: z.string().trim().min(1, "Nama Paket Kerja wajib diisi.").max(160),
  weightPct: moneyField,
  vendorId: z.string().trim().min(1).optional().nullable(),
  items: z.array(workPackageItemSchema).min(1, "Isi minimal satu item."),
});

/** Ubah Paket Kerja: item hanya sebelum kiriman pertama. */
export const updateWorkPackageSchema = z.object({
  version: z.number().int().min(1),
  name: z
    .string()
    .trim()
    .min(1, "Nama Paket Kerja wajib diisi.")
    .max(160)
    .optional(),
  weightPct: moneyField.optional(),
  vendorId: z.string().trim().min(1).optional().nullable(),
  items: z.array(workPackageItemSchema).optional(),
});

/** Terbitkan PR: nomor + tanggal; baseline paket dikunci (AC-40). */
export const createPurchaseRequestSchema = z.object({
  number: z.string().trim().min(1, "Nomor PR wajib diisi.").max(60),
  date: businessDateField,
});

/** Catat PO: nomor + tanggal + vendor (docs/04 §7). */
export const createPurchaseOrderSchema = z.object({
  number: z.string().trim().min(1, "Nomor PO wajib diisi.").max(60),
  date: businessDateField,
  vendorId: idField,
});

/** Mulai produksi: tanggal mulai (opsional). */
export const startProductionSchema = z.object({
  productionStartDate: businessDateField,
});

/** Catat kiriman: tanggal, DO, qty per item (docs/04 §7). */
export const deliveryItemSchema = z.object({
  workPackageItemId: idField,
  qty: qtyField,
});

export const createDeliverySchema = z.object({
  deliveryDate: businessDateField,
  doNumber: optionalTextField(60),
  notes: optionalTextField(1000),
  items: z.array(deliveryItemSchema).min(1, "Isi minimal satu item kiriman."),
});

/** Koreksi kiriman: qty negatif + alasan; total per item ≥ 0. */
export const deliveryCorrectionItemSchema = z.object({
  workPackageItemId: idField,
  qty: qtyField,
});

export const createDeliveryCorrectionSchema = z.object({
  deliveryDate: businessDateField,
  correctionReason: reasonField,
  items: z.array(deliveryCorrectionItemSchema).min(1),
});

/** Batal Paket Kerja: sebelum kiriman pertama; alasan + bobot pengganti. */
export const cancelWorkPackageSchema = z.object({
  version: z.number().int().min(1),
  reason: reasonField,
  weights: z.array(workPackageWeightRowSchema).min(1),
});

/** Pembayaran Paket Kerja: status, tagihan, tanggal lunas, catatan (AC-44). */
export const updatePaymentSchema = z.object({
  version: z.number().int().min(1),
  paymentStatus: z.enum(["BELUM_LUNAS", "LUNAS"]),
  invoiceAmount: optionalMoneyField,
  paidDate: optionalBusinessDateField,
  paymentNotes: optionalTextField(1000),
});

export type WorkPackageItemInput = z.infer<typeof workPackageItemSchema>;
export type PutWorkItemWeightsInput = z.infer<typeof putWorkItemWeightsSchema>;
export type WorkItemWeightInput = z.infer<typeof workItemWeightSchema>;
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;
export type CancelWithWeightsInput = z.infer<typeof cancelWithWeightsSchema>;
export type CreateUspkInput = z.infer<typeof createUspkSchema>;
export type CreateTenderAttemptInput = z.infer<
  typeof createTenderAttemptSchema
>;
export type SetTenderWinnerInput = z.infer<typeof setTenderWinnerSchema>;
export type CancelTenderAttemptInput = z.infer<
  typeof cancelTenderAttemptSchema
>;
export type CreateSpkInput = z.infer<typeof createSpkSchema>;
export type UpdateSpkInput = z.infer<typeof updateSpkSchema>;
export type ReleaseSpkInput = z.infer<typeof releaseSpkSchema>;
export type CancelSpkInput = z.infer<typeof cancelSpkSchema>;
export type CreateWorkPackageInput = z.infer<typeof createWorkPackageSchema>;
export type UpdateWorkPackageInput = z.infer<typeof updateWorkPackageSchema>;
export type CreatePurchaseRequestInput = z.infer<
  typeof createPurchaseRequestSchema
>;
export type CreatePurchaseOrderInput = z.infer<
  typeof createPurchaseOrderSchema
>;
export type StartProductionInput = z.infer<typeof startProductionSchema>;
export type DeliveryItemInput = z.infer<typeof deliveryItemSchema>;
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type DeliveryCorrectionItemInput = z.infer<
  typeof deliveryCorrectionItemSchema
>;
export type CreateDeliveryCorrectionInput = z.infer<
  typeof createDeliveryCorrectionSchema
>;
export type CancelWorkPackageInput = z.infer<typeof cancelWorkPackageSchema>;
export type WorkPackageWeightInput = z.infer<typeof workPackageWeightRowSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
