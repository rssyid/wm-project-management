import { z } from "zod";

import { moneyField } from "./fields";

const weekdayArray = z
  .array(z.number().int().min(1).max(7))
  .min(1, "Pilih minimal satu hari kerja.")
  .refine(
    (value) => new Set(value).size === value.length,
    "Hari kerja tidak boleh duplikat.",
  );

/** Pengaturan sistem: hari kerja dan ambang EWS (docs/04 §11, AC-51). */
export const updateSettingsSchema = z.object({
  workingWeekdays: weekdayArray.optional(),
  ewsYellowFrom: moneyField.optional(),
  ewsRedAbove: moneyField.optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Libur (docs/04 §11). */
export const createHolidaySchema = z.object({
  date: z
    .string()
    .trim()
    .refine(
      (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Isi tanggal dengan format YYYY-MM-DD.",
    ),
  name: z.string().trim().min(1, "Nama libur wajib diisi.").max(100),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
