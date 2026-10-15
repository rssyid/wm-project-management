import { z } from "zod";

import { isPositiveMoney } from "@/shared/money";

import {
  businessDateField,
  idField,
  moneyField,
  optionalBusinessDateField,
  optionalTextField,
  reasonField,
} from "./fields";

/** Satu baris BOQ: per bangunan atau kegiatan/paket kerja dengan harga total (docs/01 §1). */
export const boqItemSchema = z.object({
  buildingName: optionalTextField(160),
  activityName: z
    .string()
    .trim()
    .min(1, "Nama bangunan atau kegiatan wajib diisi.")
    .max(200),
  amount: moneyField,
  notes: optionalTextField(500),
});

/** docs/04 §4: attempt baru menyalin BOQ attempt ditolak lewat `copyFromAttemptId`. */
export const createAfceAttemptSchema = z.object({
  copyFromAttemptId: z.string().trim().min(1).optional(),
});

export const updateAfceAttemptSchema = z.object({
  version: z.number().int().min(1),
  afceNumber: optionalTextField(60),
  documentDate: optionalBusinessDateField,
  notes: optionalTextField(1000),
  rabReady: z.boolean().optional(),
});

/** docs/04 §4: BOQ diganti seluruhnya; nilai AFCE dihitung ulang dari baris yang dikirim. */
export const replaceBoqSchema = z.object({
  version: z.number().int().min(1),
  items: z.array(boqItemSchema).max(200),
});

/** Urutan jabatan hasil salinan tier atau hasil perubahan manual saat DRAFT (docs/01 §6). */
export const approvalLevelsSchema = z.object({
  version: z.number().int().min(1),
  positionIds: z.array(idField).min(1, "Isi minimal satu jabatan.").max(9),
});

export const submitApprovalDocSchema = z.object({
  version: z.number().int().min(1),
  submittedDate: businessDateField,
  approvalEmailDate: businessDateField,
});

/** AR tambahan: nominal, alasan, tanggal (docs/01 §6). */
const arAmountField = moneyField.refine(
  isPositiveMoney,
  "Nominal AR tambahan harus lebih besar dari nol.",
);

export const createArSupplementSchema = z.object({
  number: optionalTextField(60),
  amount: arAmountField,
  reason: reasonField,
  date: businessDateField,
});

export const updateArSupplementSchema = z.object({
  version: z.number().int().min(1),
  number: optionalTextField(60),
  amount: arAmountField,
  reason: reasonField,
  date: businessDateField,
});

/** Keputusan satu level dari SAP, dicatat user; approver tidak login (docs/01 §6). */
export const approvalDecisionSchema = z.object({
  result: z.enum(["APPROVED", "DITOLAK"]),
  approverName: z
    .string()
    .trim()
    .min(1, "Nama approver wajib diisi.")
    .max(160),
  decisionDate: businessDateField,
  notes: optionalTextField(1000),
  evidenceFileId: z.string().trim().min(1).optional(),
});

export type BoqItemInput = z.infer<typeof boqItemSchema>;
export type CreateAfceAttemptInput = z.infer<typeof createAfceAttemptSchema>;
export type UpdateAfceAttemptInput = z.infer<typeof updateAfceAttemptSchema>;
export type ReplaceBoqInput = z.infer<typeof replaceBoqSchema>;
export type SubmitApprovalDocInput = z.infer<typeof submitApprovalDocSchema>;
export type CreateArSupplementInput = z.infer<typeof createArSupplementSchema>;
export type UpdateArSupplementInput = z.infer<typeof updateArSupplementSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;