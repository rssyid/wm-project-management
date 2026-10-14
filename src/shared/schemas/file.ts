import { z } from "zod";

import { FILE_KINDS } from "@/shared/file";

export const uploadUrlSchema = z.object({
  kind: z.enum(FILE_KINDS),
  projectId: z.string().trim().min(1, "Pilih proyek terlebih dahulu."),
  ownerType: z.string().trim().min(1).max(40),
  ownerId: z.string().trim().min(1).max(60),
  originalName: z.string().trim().min(1, "Nama file wajib diisi.").max(200),
  mimeType: z.string().trim().min(1, "Tipe file wajib diisi."),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive("Ukuran file harus lebih dari 0 byte."),
});

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
