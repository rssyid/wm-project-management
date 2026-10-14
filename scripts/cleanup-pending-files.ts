import "./env";

import { deleteStalePendingFiles } from "@/domain/files/service";
import { prisma } from "@/infra/db";

/**
 * Membersihkan berkas PENDING lebih dari 24 jam (AC-62). Dijalankan workflow harian GitHub
 * Actions, bukan oleh aplikasi.
 */
async function main() {
  const result = await deleteStalePendingFiles();
  console.log(
    `Berkas PENDING sebelum ${result.cutoff.toISOString()} dihapus: ${result.deleted}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
