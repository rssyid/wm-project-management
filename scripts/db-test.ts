import { spawnSync } from "node:child_process";

import "./env";

// Test database only (branch Neon `test`): applies migrations and seeds master data there.
// The app and prisma.config.ts keep using DATABASE_URL/DIRECT_URL, so production and the
// development branch are never touched by this script.
async function main() {
  const testUrl = process.env.TEST_DATABASE_URL;
  const testDirectUrl = process.env.TEST_DIRECT_URL;
  if (!testUrl || !testDirectUrl) {
    throw new Error("TEST_DATABASE_URL dan TEST_DIRECT_URL wajib diisi.");
  }

  const env = {
    ...process.env,
    DATABASE_URL: testUrl,
    DIRECT_URL: testDirectUrl,
  };
  const migrate = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { stdio: "inherit", env },
  );
  if (migrate.status !== 0) {
    throw new Error(`prisma migrate deploy gagal (kode ${migrate.status})`);
  }

  // src/infra/db membaca DATABASE_URL saat modul dimuat, jadi env diganti lebih dulu.
  process.env.DATABASE_URL = testUrl;
  const { runSeed } = await import("../prisma/seed/run");
  const { prisma } = await import("../src/infra/db");
  const result = await runSeed();
  console.log(
    `Test DB siap: lokasi ${JSON.stringify(result.lokasi)}, master ${JSON.stringify(result.master)}.`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
