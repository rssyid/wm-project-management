import { z } from "zod";

/** Skema dipakai bersama oleh form klien dan route handler (docs/02 §1). */
export const loginSchema = z.object({
  email: z.email("Masukkan email yang valid."),
  password: z.string().min(1, "Masukkan password."),
});

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password minimal 8 karakter."),
    confirmPassword: z.string().min(1, "Ulangi password baru."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Pengulangan password tidak sama dengan password baru.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
