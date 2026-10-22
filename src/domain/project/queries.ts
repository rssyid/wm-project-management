import { decimalToString } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import { businessDateIso } from "@/shared/date";
import type { ProjectFilters } from "@/shared/schemas/project";
import type { ProjectStatus } from "@/shared/project-status";

const listSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  targetStartDate: true,
  targetEndDate: true,
  plannedBudget: true,
  completedAt: true,
  cancelledAt: true,
  deletedAt: true,
  company: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, code: true, name: true } },
  pic: { select: { id: true, name: true } },
  estates: {
    select: {
      isPrimary: true,
      estate: {
        select: {
          id: true,
          code: true,
          name: true,
          wilayah: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

type ListRow = Prisma.ProjectGetPayload<{ select: typeof listSelect }>;

function iso(value: Date | null): string | null {
  return value ? businessDateIso(value) : null;
}

/** Bentuk untuk UI: uang jadi string desimal dan tanggal jadi `YYYY-MM-DD` (rule 20). */
function toListItem(row: ListRow) {
  const main = row.estates.find((estate) => estate.isPrimary)?.estate;
  const archived =
    (row.status === "COMPLETED" || row.status === "CANCELLED") &&
    row.deletedAt === null &&
    isArchivedByAge(row.status, row.completedAt, row.cancelledAt);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    archived,
    company: row.company,
    category: row.category,
    mainEstate: main
      ? { code: main.code, name: main.name, wilayah: main.wilayah.name }
      : null,
    otherEstateCount: Math.max(row.estates.length - 1, 0),
    plannedBudget: decimalToString(row.plannedBudget),
    pic: row.pic?.name ?? null,
    targetStartDate: iso(row.targetStartDate),
    targetEndDate: iso(row.targetEndDate),
  };
}

/** Arsip otomatis 1 tahun setelah COMPLETED/CANCELLED (docs/01 §12, AC-69). */
function isArchivedByAge(
  status: ProjectStatus,
  completedAt: Date | null,
  cancelledAt: Date | null,
): boolean {
  const reference = status === "COMPLETED" ? completedAt : cancelledAt;
  if (!reference) return false;
  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  return reference <= oneYearAgo;
}

/**
 * AC-13: proyek multi-Estate muncul di setiap filter wilayah, region, maupun Estate karena
 * filter diterapkan pada baris ProjectEstate, bukan hanya Estate utama.
 */
export async function listProjects(filters: ProjectFilters) {
  const locationFilter = [
    ...filters.estateIds.map((estateId) => ({ estateId })),
    ...filters.wilayahIds.map((wilayahId) => ({
      estate: { wilayah: { id: wilayahId } },
    })),
    ...filters.regionIds.map((regionId) => ({
      estate: { wilayah: { regionId } },
    })),
  ];

  const where = {
    ...(filters.archived ? {} : { deletedAt: null }),
    ...(filters.status.length > 0
      ? { status: { in: filters.status as ProjectStatus[] } }
      : {}),
    ...(filters.companyIds.length > 0
      ? { companyId: { in: filters.companyIds } }
      : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { code: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(locationFilter.length > 0
      ? { estates: { some: { OR: locationFilter } } }
      : {}),
    ...(filters.archived
      ? {
          status: { in: ["COMPLETED", "CANCELLED"] as ProjectStatus[] },
          deletedAt: null,
          OR: [
            {
              status: "COMPLETED" as ProjectStatus,
              completedAt: {
                lte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
              },
            },
            {
              status: "CANCELLED" as ProjectStatus,
              cancelledAt: {
                lte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        }
      : {
          deletedAt: null,
          status: {
            notIn: ["COMPLETED", "CANCELLED"] as ProjectStatus[],
          },
        }),
  };

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: listSelect,
      orderBy: { code: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  return { data: rows.map(toListItem), total };
}

export async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      status: true,
      version: true,
      plannedBudget: true,
      targetStartDate: true,
      targetEndDate: true,
      previousStatus: true,
      onHoldReason: true,
      deletedAt: true,
      company: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, code: true, name: true } },
      pic: { select: { id: true, name: true } },
      estates: {
        select: {
          isPrimary: true,
          block: { select: { id: true, blockCode: true, name: true } },
          estate: {
            select: {
              id: true,
              code: true,
              name: true,
              wilayah: {
                select: {
                  id: true,
                  name: true,
                  region: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      },
      survey: {
        select: {
          id: true,
          surveyDate: true,
          surveyorNames: true,
          existingCondition: true,
          recommendation: true,
          latitude: true,
          longitude: true,
          notes: true,
          version: true,
        },
      },
      afceAttempts: {
        select: {
          id: true,
          attemptNo: true,
          status: true,
          basisAmount: true,
          submittedDate: true,
          afceNumber: true,
        },
        orderBy: { attemptNo: "desc" },
      },
      arSupplements: {
        select: {
          id: true,
          number: true,
          amount: true,
          status: true,
          date: true,
        },
        orderBy: { date: "desc" },
      },
      budgetEntries: {
        select: { id: true, type: true, amount: true, effectiveDate: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project || project.deletedAt) return null;

  return {
    ...project,
    deletedAt: undefined,
    plannedBudget: decimalToString(project.plannedBudget),
    targetStartDate: iso(project.targetStartDate),
    targetEndDate: iso(project.targetEndDate),
    survey: project.survey
      ? {
          ...project.survey,
          surveyDate: iso(project.survey.surveyDate),
          latitude: project.survey.latitude?.toFixed(6) ?? null,
          longitude: project.survey.longitude?.toFixed(6) ?? null,
        }
      : null,
    afceAttempts: project.afceAttempts.map((attempt) => ({
      ...attempt,
      basisAmount: decimalToString(attempt.basisAmount),
      submittedDate: iso(attempt.submittedDate),
    })),
    arSupplements: project.arSupplements.map((supplement) => ({
      ...supplement,
      amount: decimalToString(supplement.amount),
      date: iso(supplement.date),
    })),
    budgetEntries: project.budgetEntries.map((entry) => ({
      ...entry,
      amount: decimalToString(entry.amount),
      effectiveDate: iso(entry.effectiveDate),
    })),
  };
}

export async function getProjectByCode(code: string) {
  const row = await prisma.project.findUnique({
    where: { code },
    select: { id: true },
  });
  return row ? getProject(row.id) : null;
}

export async function getProjectHistory(projectId: string) {
  const [statusHistory, auditLogs] = await Promise.all([
    prisma.projectStatusHistory.findMany({
      where: { projectId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { at: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { projectId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { statusHistory, auditLogs };
}

/** Data Pekerjaan untuk tab Pekerjaan workspace proyek. */
export async function listWorkItems(projectId: string) {
  return prisma.workItem.findMany({
    where: { projectId, cancelledAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      projectWeightPct: true,
      physicalWeightPct: true,
      materialWeightPct: true,
      targetVolume: true,
      unitId: true,
      order: true,
      version: true,
      physicalProcess: {
        select: { id: true, status: true, actualStart: true, actualEnd: true },
      },
      tenderAttempts: {
        select: {
          id: true,
          attemptNo: true,
          status: true,
          winnerVendorId: true,
          winnerNameSnapshot: true,
          cancelledDate: true,
        },
        orderBy: { attemptNo: "desc" },
      },
      spks: {
        select: {
          id: true,
          number: true,
          date: true,
          value: true,
          status: true,
          releasedDate: true,
          cancelledDate: true,
          vendorId: true,
          tenderAttemptId: true,
        },
        orderBy: { createdAt: "asc" },
      },
      workPackages: {
        select: {
          id: true,
          name: true,
          weightPct: true,
          status: true,
          vendorId: true,
          cancelledDate: true,
          cancelReason: true,
          completedDate: true,
          productionStartDate: true,
          version: true,
        },
        where: { cancelledDate: null },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });
}

/** Data SPK untuk tab Paket Kerja workspace proyek. */
export async function listSpks(projectId: string) {
  return prisma.spk.findMany({
    where: { workItem: { projectId } },
    select: {
      id: true,
      number: true,
      date: true,
      value: true,
      status: true,
      releasedDate: true,
      cancelledDate: true,
      cancelReason: true,
      vendorId: true,
      tenderAttemptId: true,
      workItemId: true,
      vendor: { select: { id: true, name: true, type: true } },
      tenderAttempt: { select: { attemptNo: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Data Paket Kerja untuk tab Paket Kerja workspace proyek. */
export async function listWorkPackages(projectId: string) {
  return prisma.workPackage.findMany({
    where: { workItem: { projectId }, cancelledDate: null },
    select: {
      id: true,
      workItemId: true,
      name: true,
      weightPct: true,
      status: true,
      vendorId: true,
      cancelledDate: true,
      cancelReason: true,
      completedDate: true,
      productionStartDate: true,
      version: true,
      purchaseRequest: { select: { id: true, number: true, date: true } },
      purchaseOrder: {
        select: { id: true, number: true, date: true, vendorId: true },
      },
      items: {
        select: {
          id: true,
          materialId: true,
          unitId: true,
          plannedQty: true,
          order: true,
        },
        orderBy: { order: "asc" },
      },
      deliveries: {
        select: {
          id: true,
          deliveryDate: true,
          isCorrection: true,
          correctionReason: true,
          items: {
            select: {
              id: true,
              workPackageItemId: true,
              qty: true,
            },
          },
        },
        orderBy: { deliveryDate: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
