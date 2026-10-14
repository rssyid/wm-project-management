import { config } from "dotenv";

// Skrip seed dan prepare database dijalankan di luar Next.js, jadi `.env.local` dimuat di
// sini (pola yang sama dengan prisma.config.ts). Wajib diimpor paling awal karena
// src/infra/db membaca DATABASE_URL saat modul dimuat.
config({ path: ".env.local", quiet: true });
