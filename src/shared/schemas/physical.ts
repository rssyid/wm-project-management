import { z } from "zod";

import {
  businessDateField,
  optionalBusinessDateField,
  idField,
  moneyField,
  optionalTextField,
  reasonField,
} from "./fields";

/** Mulai proses fisik Pekerjaan (docs/04 §6). */
export const startPhysicalSchema = z.object({
  startedDate: optionalBusinessDateField,
});

/** Catat log progres mingguan (docs/04 §6, docs/01 §8). */
export const createProgressLogSchema = z.object({
  weekStart: businessDateField,
  cumulativePct: moneyField,
  volume: optionalTextField(20),
  notes: optionalTextField(1000),
  decreaseReason: optionalTextField(500),
  equipment: z
    .array(
      z.object({
        heavyEquipmentTypeId: idField,
        unitCount: z
          .string()
          .trim()
          .refine(
            (v) => /^\d{1,9}$/.test(v.trim()),
            "Isi jumlah unit dengan angka maksimal 9 digit.",
          ),
        workingHours: moneyField,
        vendorId: idField.optional().nullable(),
        notes: optionalTextField(1000),
      }),
    )
    .optional(),
  photoFileIds: z.array(idField).optional(),
});

/** Log pengganti minggu yang sama (docs/01 §8). */
export const supersedeProgressLogSchema = z.object({
  weekStart: businessDateField,
  reason: reasonField,
});

export type StartPhysicalInput = z.infer<typeof startPhysicalSchema>;
export type CreateProgressLogInput = z.infer<typeof createProgressLogSchema>;
export type SupersedeProgressLogInput = z.infer<
  typeof supersedeProgressLogSchema
>;
