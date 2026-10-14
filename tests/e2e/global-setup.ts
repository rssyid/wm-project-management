import { spawnSync } from "node:child_process";

/**
 * Playwright memuat file setup sebagai CommonJS, sedangkan Prisma Client hasil generate
 * hanya bisa dimuat sebagai ES module. Karena itu penyemaian akun dijalankan sebagai proses
 * terpisah dengan tsx, sama seperti skrip seed.
 */
export default function globalSetup() {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/seed-e2e-accounts.ts"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("Penyemaian akun e2e gagal.");
  }
}
