import "../scripts/env";

import { prisma } from "@/infra/db";

import { runSeed } from "./seed/run";

runSeed()
  .then(async (result) => {
    console.log(
      `Seed selesai: lokasi ${JSON.stringify(result.lokasi)}, master ${JSON.stringify(
        result.master,
      )}, Super Admin ${result.superAdminCreated ? "dibuat" : "sudah ada"}.`,
    );
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
