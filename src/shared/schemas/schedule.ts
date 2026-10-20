import { z } from "zod";

import { businessDateField, reasonField } from "./fields";

/** Ubah rencana baseline sebelum dikunci (docs/04 §8). */
export const updateScheduleBaselineSchema = z.object({
  plannedStart: businessDateField,
  plannedEnd: businessDateField,
});

/** Revisi baseline setelah dikunci: alasan wajib (AC-45, AC-46). */
export const createScheduleRevisionSchema = z.object({
  plannedStart: businessDateField,
  plannedEnd: businessDateField,
  reason: reasonField,
});

export type UpdateScheduleBaselineInput = z.infer<
  typeof updateScheduleBaselineSchema
>;
export type CreateScheduleRevisionInput = z.infer<
  typeof createScheduleRevisionSchema
>;
