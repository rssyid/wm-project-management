import { decimalToString, type DecimalValue } from "@/infra/decimal";
import { prisma } from "@/infra/db";
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

type ListRow = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  targetStartDate: Date | null;
  targetEndDate: Date | null;
  plannedBudget: DecimalValue | null;
  company: { id: string; code: string; name: string };
  category: { id: string; code: string; name: string };
  pic: { id: string; name: string } | null;
  estates: {
    isPrimary: boolean;
    estate: {
      id: string;
      code: string;
      name: string;
      wilayah: { id: string; name: string };
    };
  }[];
};

function iso(value: Date | null): string | null {
  return value ? businessDateIso(value) : null;
}

/** Bentuk untuk UI: uang jadi string desimal dan tanggal jadi `YYYY-MM-DD` (rule 20). */
function toListItem(row: ListRow) {
  const main = row.estates.find((estate) => estate.isPrimary)?.estate;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
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
    deletedAt: null,
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
      survey: { select: { id: true, surveyDate: true, surveyorNames: true } },
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
      ? { ...project.survey, surveyDate: iso(project.survey.surveyDate) }
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

/** Dipakai modul lain (AFCE, survei) untuk tahu apakah AFCE pernah diajukan. */
export async function hasSubmittedAfce(projectId: string): Promise<boolean> {
  const count = await prisma.afceAttempt.count({
    where: { projectId, submittedDate: { not: null } },
  });
  return count > 0;
}
