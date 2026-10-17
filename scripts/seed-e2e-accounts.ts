import "./env";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { seedLokasi } from "../prisma/seed/lokasi";
import {
  ALL_E2E_ACCOUNTS,
  E2E_PASSWORD,
  PASSWORD_CHANGE_ACCOUNTS,
} from "../tests/e2e/accounts";

/**
 * Tier e2e dihapus lalu diganti dengan satu tier bersama.
 *
 * D-34: matriks approval adalah state global dan suite e2e berjalan paralel (4 worker pada
 * branch Neon yang sama), jadi test tidak boleh membuat tier sendiri — dua tier dengan rentang
 * tumpang tindih saling menabrak dan satu test menghapus tier yang sedang dipakai test lain.
 * Satu tier bersama dibuat sekali di sini (serial, sebelum test berjalan) dan dipakai semua
 * spec: rentang [0, 500.000.000) menutup nilai AFCE uji Rp450.000.000 (AC-18), dan
 * project-flow.spec.ts menambah tier [500.000.000, ∞) di atasnya sehingga tetap tanpa
 * tumpang tindih maupun berlubang.
 *
 * Jabatan approver memakai jabatan seed (rank 1-9) sehingga tidak menambah baris
 * ApprovalPosition baru; rank-nya unik dan berbatas.
 */
const SHARED_TIER_NAME = "Tier e2e bersama";
const SHARED_TIER_MIN = "0";
const SHARED_TIER_MAX = "500000000";

async function resetApprovalMatrix() {
  // Kedua pola nama adalah sisa test, bukan seed produksi: `Tier e2e` (project-flow.spec.ts dan
  // tier bersama di bawah) dan `Tier AFCE E2E` (percobaan lama sebelum D-34). Sisa tier dengan
  // rentang tumpang tindih membuat penambahan tier baru ditolak `assertNoOverlapOrGap`.
  const stale = await prisma.approvalMatrixTier.findMany({
    where: {
      OR: [
        { name: { startsWith: "Tier e2e" } },
        { name: { startsWith: "Tier AFCE E2E" } },
      ],
    },
    select: { id: true },
  });
  const staleIds = stale.map((tier) => tier.id);
  if (staleIds.length > 0) {
    // Attempt dan AR uji lebih dulu dilepas dari tier karena relasinya Restrict.
    await prisma.afceAttempt.updateMany({
      where: { matrixTierId: { in: staleIds } },
      data: { matrixTierId: null },
    });
    await prisma.arSupplement.updateMany({
      where: { matrixTierId: { in: staleIds } },
      data: { matrixTierId: null },
    });
    await prisma.approvalMatrixTier.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  const position = await prisma.approvalPosition.findFirst({
    orderBy: { rank: "asc" },
    select: { id: true, name: true },
  });
  if (!position)
    throw new Error("Tidak ada jabatan approver untuk tier e2e bersama.");

  const tier = await prisma.approvalMatrixTier.create({
    data: {
      name: SHARED_TIER_NAME,
      forAfce: true,
      forArSupplement: true,
      minAmount: new Prisma.Decimal(SHARED_TIER_MIN),
      maxAmount: new Prisma.Decimal(SHARED_TIER_MAX),
      levels: { create: [{ levelNo: 1, positionId: position.id }] },
    },
    select: { id: true },
  });
  return { removed: staleIds.length, position: position.name, tierId: tier.id };
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

  // Lokasi seed dipakai form proyek: tanpa Region/Wilayah/Company, dropdown "Perusahaan"
  // kosong dan test alur proyek tidak bisa memilih estate (AC-61).
  const lokasi = await seedLokasi();
  const matriks = await resetApprovalMatrix();

  console.log(
    `Akun e2e siap: ${ALL_E2E_ACCOUNTS.length}. ` +
      `Lokasi seed: ${lokasi.companies} company, ${lokasi.estates} estate. ` +
      `Tier e2e dihapus: ${matriks.removed}, tier bersama dibuat (jabatan ${matriks.position}).`,
  );
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
