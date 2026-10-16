import "./env";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/infra/db";

import {
  ALL_E2E_ACCOUNTS,
  E2E_PASSWORD,
  PASSWORD_CHANGE_ACCOUNTS,
} from "../tests/e2e/accounts";

/**
 * Tier e2e dihapus agar matriks approval bersih dari nol setiap run: matriks tidak boleh punya
 * nominal tanpa tier (AC-18), sehingga tier sisa run sebelumnya membuat penambahan tier baru
 * ditolak. Attempt dan AR uji lebih dulu dilepas dari tier karena relasinya Restrict.
 */
async function removeE2eTiers() {
  const tiers = await prisma.approvalMatrixTier.findMany({
    where: { name: { startsWith: "Tier e2e" } },
    select: { id: true },
  });
  const ids = tiers.map((tier) => tier.id);
  if (ids.length === 0) return 0;

  await prisma.afceAttempt.updateMany({
    where: { matrixTierId: { in: ids } },
    data: { matrixTierId: null },
  });
  await prisma.arSupplement.updateMany({
    where: { matrixTierId: { in: ids } },
    data: { matrixTierId: null },
  });
  const deleted = await prisma.approvalMatrixTier.deleteMany({
    where: { id: { in: ids } },
  });
  return deleted.count;
}

/**
 * Akun uji untuk Playwright, dibuat di database yang sama dengan `next start` (branch Neon
 * dev). Password dikembalikan ke nilai awal dan session lama dihapus supaya test ganti
 * password (AC-04) bisa dijalankan berulang.
 */
async function main() {
  const hashed = await hashPassword(E2E_PASSWORD);
  const temporaryEmails = Object.values(PASSWORD_CHANGE_ACCOUNTS).map(
    (account) => account.email,
  );

  for (const account of ALL_E2E_ACCOUNTS) {
    const mustChangePassword = temporaryEmails.includes(account.email);
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true },
    });
    const userId = existing?.id ?? crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { email: account.email },
        create: {
          id: userId,
          name: account.name,
          email: account.email,
          emailVerified: true,
          role: account.role,
          isActive: true,
          mustChangePassword,
        },
        update: {
          name: account.name,
          role: account.role,
          isActive: true,
          mustChangePassword,
        },
      });

      const updated = await tx.account.updateMany({
        where: { userId, providerId: "credential" },
        data: { password: hashed },
      });
      if (updated.count === 0) {
        await tx.account.create({
          data: {
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: "credential",
            userId,
            password: hashed,
          },
        });
      }

      await tx.session.deleteMany({ where: { userId } });
    });
  }

  const removedTiers = await removeE2eTiers();

  console.log(
    `Akun e2e siap: ${ALL_E2E_ACCOUNTS.length}. Tier e2e dihapus: ${removedTiers}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
