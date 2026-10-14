import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/infra/db";

import { seedLokasi, type LokasiCounts } from "./lokasi";
import { seedMaster, type MasterCounts } from "./master";

export type SeedResult = {
  lokasi: LokasiCounts;
  master: MasterCounts;
  superAdminCreated: boolean;
};

/** docs/03 §5: satu AuditLog aksi IMPORT per kelompok data, actor kosong. */
async function writeImportAudit(
  entityType: string,
  after: Record<string, number>,
) {
  await prisma.auditLog.create({
    data: {
      actorId: null,
      entityType,
      entityId: entityType,
      action: "IMPORT",
      after,
    },
  });
}

/**
 * Super Admin pertama. Password sementara dari environment variable; user wajib ganti
 * password pada login pertama. Tidak menimpa akun yang sudah ada supaya seed idempoten.
 */
async function seedSuperAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi untuk membuat Super Admin pertama",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return false;

  const hashed = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const userId = crypto.randomUUID();
    await tx.user.create({
      data: {
        id: userId,
        name: "Super Admin",
        email,
        emailVerified: true,
        role: "SUPER_ADMIN",
        isActive: true,
        mustChangePassword: true,
      },
    });
    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        entityType: "User",
        entityId: userId,
        action: "CREATE",
        after: { email, role: "SUPER_ADMIN", mustChangePassword: true },
      },
    });
  });
  return true;
}

/** docs/03 §5: idempoten pada kunci alami, jadi aman dijalankan berkali-kali. */
export async function runSeed(): Promise<SeedResult> {
  const lokasi = await seedLokasi();
  await writeImportAudit("Lokasi", lokasi);
  const master = await seedMaster();
  await writeImportAudit("Master", master);
  const superAdminCreated = await seedSuperAdmin();
  return { lokasi, master, superAdminCreated };
}
