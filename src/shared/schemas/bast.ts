import { z } from "zod";

import { idField, optionalBusinessDateField, reasonField } from "./fields";

/** Pengajuan BAST: nomor, tanggal, dan lampiran file (kind BAST). */
export const submitBastSchema = z.object({
  number: z.string().trim().min(1, "Nomor BAST wajib diisi.").max(50),
  date: optionalBusinessDateField,
  fileId: idField,
});

/** Batal pengajuan BAST: alasan wajib. */
export const cancelBastSchema = z.object({
  bastId: idField,
  reason: reasonField,
});

/** Purge proyek: konfirmasi dengan mengetik kode proyek. */
export const purgeProjectSchema = z.object({
  projectId: idField,
  code: z.string().trim().min(1, "Ketik kode proyek untuk konfirmasi purge."),
});
