import { versionConflict, writeAudit } from "@/domain/audit/service";
import { nextProjectCode } from "@/domain/project/code";
import { estateRows, validateProjectEstates } from "@/domain/project/location";
import {
  requireMutableProject,
  startSurvey as startSurveyTransition,
} from "@/domain/project-transition/service";
import { decimal } from "@/infra/decimal";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { parseBusinessDate } from "@/shared/date";
import { DomainError } from "@/shared/errors";
import type {
  CreateProjectInput,
  ProjectEstateInput,
  UpdateProjectInput,
} from "@/shared/schemas/project";
import { PROJECT_STATUS_LABEL } from "@/shared/project-status";

const projectAuditSelect = {
  id: true,
  name: true,
  description: true,
  picUserId: true,
  targetStartDate: true,
  targetEndDate: true,
  plannedBudget: true,
  version: true,
} as const;

function dateOf(value: string | null | undefined): Date | null {
  return value ? parseBusinessDate(value) : null;
}

function moneyOf(value: string | null | undefined) {
  return value ? decimal(value) : null;
}

async function afceAlreadySubmitted(
  tx: Tx,
  projectId: string,
): Promise<boolean> {
  const count = await tx.afceAttempt.count({
    where: { projectId, submittedDate: { not: null } },
  });
  return count > 0;
}

/**
 * AC-10 dan AC-11: kode diambil dari counter yang dikunci di dalam transaksi, Estate minimal
 * satu dengan tepat satu utama dan semuanya milik Company proyek.
 */
export async function createProject(
  input: CreateProjectInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, code: true },
    });
    if (!company)
      throw new DomainError("NOT_FOUND", "Company tidak ditemukan.");

    const category = await tx.projectCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new DomainError("NOT_FOUND", "Kategori proyek tidak ditemukan.");
    }

    await validateProjectEstates(tx, company.id, input.estates);

    const code = await nextProjectCode(tx, company.code, company.id);
    const created = await tx.project.create({
      data: {
        code,
        name: input.name,
        description: input.description ?? null,
        companyId: company.id,
        categoryId: category.id,
        picUserId: input.picUserId ?? null,
        targetStartDate: dateOf(input.targetStartDate),
        targetEndDate: dateOf(input.targetEndDate),
        plannedBudget: moneyOf(input.plannedBudget),
        createdById: actorId,
        estates: { create: estateRows(input.estates) },
      },
      select: { id: true, code: true, name: true, status: true, version: true },
    });

    await writeAudit(tx, {
      actorId,
      projectId: created.id,
      entityType: "Project",
      entityId: created.id,
      action: "CREATE",
      after: { code: created.code, name: created.name, companyId: company.id },
    });
    return created;
  });
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    await requireMutableProject(tx, projectId);
    const before = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: projectAuditSelect,
    });

    // Anggaran rencana terkunci begitu AFCE pertama diajukan (docs/04 §3).
    if (
      input.plannedBudget !== undefined &&
      (await afceAlreadySubmitted(tx, projectId))
    ) {
      throw new DomainError(
        "FIELD_INPUT_LOCKED",
        "Anggaran rencana terkunci karena AFCE sudah diajukan.",
      );
    }

    const updated = await tx.project.updateMany({
      where: { id: projectId, version: input.version },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.picUserId === undefined
          ? {}
          : { picUserId: input.picUserId }),
        ...(input.targetStartDate === undefined
          ? {}
          : { targetStartDate: dateOf(input.targetStartDate) }),
        ...(input.targetEndDate === undefined
          ? {}
          : { targetEndDate: dateOf(input.targetEndDate) }),
        ...(input.plannedBudget === undefined
          ? {}
          : { plannedBudget: moneyOf(input.plannedBudget) }),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    const after = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: projectAuditSelect,
    });
    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "Project",
      entityId: projectId,
      action: "UPDATE",
      before,
      after,
    });
    return after;
  });
}

/** Lokasi terkunci begitu proyek masuk PROCUREMENT (A-03). */
export async function replaceProjectEstates(
  projectId: string,
  estates: readonly ProjectEstateInput[],
  version: number,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const project = await requireMutableProject(tx, projectId);
    if (project.status !== "DRAFT" && project.status !== "SURVEY") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Lokasi proyek tidak bisa diubah saat status "${PROJECT_STATUS_LABEL[project.status]}".`,
      );
    }
    const owner = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { companyId: true },
    });
    await validateProjectEstates(tx, owner.companyId, estates);

    const before = await tx.projectEstate.findMany({
      where: { projectId },
      select: { estateId: true, blockId: true, isPrimary: true },
      orderBy: { estateId: "asc" },
    });

    const updated = await tx.project.updateMany({
      where: { id: projectId, version },
      data: { version: { increment: 1 } },
    });
    if (updated.count === 0) throw versionConflict();

    await tx.projectEstate.deleteMany({ where: { projectId } });
    await tx.projectEstate.createMany({
      data: estateRows(estates).map((estate) => ({ projectId, ...estate })),
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "Project",
      entityId: projectId,
      action: "UPDATE",
      reason: "Lokasi proyek",
      before: { estates: before },
      after: { estates: estateRows(estates) },
    });
    return { id: projectId };
  });
}

/** DRAFT → SURVEY lewat transition service; respons memuat status terbaru (docs/04 §1). */
export async function startSurvey(projectId: string, actorId: string) {
  return withTransaction(async (tx) => {
    await startSurveyTransition(tx, projectId, actorId);
    return tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, code: true, status: true, version: true },
    });
  });
}
