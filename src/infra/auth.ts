import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/infra/db";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Better Auth mematikan cek origin otomatis saat `isTest()` (create-context.mjs:211),
  // sehingga test tidak akan pernah melihat 403. Nilai false memaksa perilaku produksi
  // juga di integration test.
  advanced: { disableOriginCheck: false },
  // Better Auth hanya mempercayai origin dari `baseURL`; hostname preview Vercel berbeda
  // setiap PR sehingga satu baseURL tidak cukup (docs/02 §8). Production ditulis eksplisit
  // supaya tidak bergantung pada perilaku wildcard.
  trustedOrigins: [
    "https://wm-project-management.vercel.app",
    "https://*.vercel.app",
  ],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // docs/02 §7: tanpa pendaftaran mandiri; Super Admin yang membuat user.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // Default Better Auth (3 percobaan sign-in per 10 detik per IP) mengunci user yang satu
  // kantor berada di belakang IP yang sama; batas longgar di sini tetap menahan brute force.
  rateLimit: {
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/*": { window: 60, max: 20 },
      "/sign-up/*": { window: 60, max: 20 },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "MANAGEMENT_VIEWER",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // User yang dinonaktifkan Super Admin tidak boleh mendapat session baru.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });
          if (user && !user.isActive) return false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});
