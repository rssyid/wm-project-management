import { runSeed } from "../../../prisma/seed/run";
import { prisma } from "@/infra/db";
import type { ProjectStatus } from "@/shared/project-status";
import type { Role } from "@/shared/role";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";

let seeded = false;

/** Master + lokasi seed dipakai hampir semua test; idempoten jadi cukup satu kali per file. */
export async function ensureSeed() {
  if (seeded) return;
  await runSeed();
  seeded = true;
}

export type UserOptions = {
  role?: Role;
  name?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
};

export async function createUser(options: UserOptions = {}) {
  const id = crypto.randomUUID();
  const email = options.email ?? `user-${id.slice(0, 8)}@test.local`;
  const password = options.password ?? "Password123!";
  const hashed = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id,
        name: options.name ?? "Pengguna Uji",
        email,
        emailVerified: true,
        role: options.role ?? "MANAGEMENT_VIEWER",
        isActive: options.isActive ?? true,
        mustChangePassword: options.mustChangePassword ?? false,
      },
    });
    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashed,
      },
    });
  });
  return { id, email, password };
}

export async function createProject(options: {
  name?: string;
  createdById: string;
  companyId?: string;
  estateId?: string;
  picUserId?: string | null;
  targetStartDate?: Date;
  targetEndDate?: Date;
  plannedBudget?: string | number;
  status?: ProjectStatus;
}) {
  const company = options.companyId
    ? await prisma.company.findUniqueOrThrow({
        where: { id: options.companyId },
      })
    : await prisma.company.findFirstOrThrow({ orderBy: { code: "asc" } });
  const category = await prisma.projectCategory.findFirstOrThrow();
  const estate = options.estateId
    ? await prisma.estate.findUniqueOrThrow({ where: { id: options.estateId } })
    : await prisma.estate.findFirstOrThrow({ orderBy: { code: "asc" } });
  const project = await prisma.project.create({
    data: {
      code: `WM-TEST-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      name: options.name ?? "Proyek Uji",
      companyId: company.id,
      categoryId: category.id,
      picUserId: options.picUserId ?? null,
      targetStartDate: options.targetStartDate ?? null,
      targetEndDate: options.targetEndDate ?? null,
      plannedBudget:
        options.plannedBudget === undefined
          ? null
          : new Prisma.Decimal(options.plannedBudget),
      status: options.status ?? "DRAFT",
      createdById: options.createdById,
      estates: { create: { estateId: estate.id, isPrimary: true } },
    },
  });
  return { project, company, category, estate };
}

export async function createWorkItem(
  projectId: string,
  options: {
    type?: "TENDER_CONTRACT" | "SWAKELOLA" | "PURCHASE";
    physicalWeightPct?: number;
    materialWeightPct?: number;
  } = {},
) {
  const type = options.type ?? "TENDER_CONTRACT";
  return prisma.workItem.create({
    data: {
      projectId,
      name: "Pekerjaan Uji",
      type,
      projectWeightPct: 100,
      physicalWeightPct: options.physicalWeightPct ?? 100,
      materialWeightPct: options.materialWeightPct ?? 0,
    },
  });
}
