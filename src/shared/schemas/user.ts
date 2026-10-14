import { z } from "zod";

import { ROLES } from "../role";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120),
  email: z
    .email("Format email tidak valid.")
    .transform((value) => value.toLowerCase()),
  role: z.enum(ROLES),
  temporaryPassword: z
    .string()
    .min(8, "Password sementara minimal 8 karakter."),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  temporaryPassword: z
    .string()
    .min(8, "Password sementara minimal 8 karakter."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
