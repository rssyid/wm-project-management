import { versionConflict, writeAudit } from "@/domain/audit/service";
import { attachFiles, listOwnerFiles } from "@/domain/files/links";
import {
  assertFieldInputAllowed,
  requireMutableProject,
} from "@/domain/project-transition/service";
import { decimal } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import { withTransaction } from "@/infra/tx";
import { businessDateIso, parseBusinessDate } from "@/shared/date";
import { DomainError } from "@/shared/errors";
import type { FileKind } from "@/shared/file";
import type { SurveyInput } from "@/shared/schemas/survey";

const OWNER_TYPE = "Survey";

function coordinate(value: string | null | undefined) {
  return value ? decimal(value) : null;
}

export async function getSurvey(projectId: string) {
  const survey = await prisma.survey.findUnique({
    where: { projectId },
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
  });
  if (!survey) return null;

  const files = await listOwnerFiles(prisma, OWNER_TYPE, survey.id);
  return {
    ...survey,
    surveyDate: businessDateIso(survey.surveyDate),
    latitude: survey.latitude?.toFixed(6) ?? null,
    longitude: survey.longitude?.toFixed(6) ?? null,
    files: {
      photos: files.filter((file) => file.kind === "PROGRESS_PHOTO"),
      documents: files.filter((file) => file.kind === "DOCUMENT"),
      spatial: files.filter((file) => file.kind === "SPATIAL_DATA"),
    },
  };
}

/**
 * Survei terkunci setelah AFCE pertama diajukan (A-01). Foto memakai kind PROGRESS_PHOTO
 * dengan batas 5 MB; dokumen dan data spasial memakai DOCUMENT dan SPATIAL_DATA (10 MB).
 */
export async function upsertSurvey(
  projectId: string,
  input: SurveyInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const project = await requireMutableProject(tx, projectId);
    assertFieldInputAllowed(project);
    if (project.status === "DRAFT") {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Isi survei setelah Mulai Survei.",
      );
    }
    const submitted = await tx.afceAttempt.count({
      where: { projectId, submittedDate: { not: null } },
    });
    if (submitted > 0) {
      throw new DomainError(
        "FIELD_INPUT_LOCKED",
        "Survei terkunci karena AFCE sudah diajukan.",
      );
    }

    const values = {
      surveyDate: parseBusinessDate(input.surveyDate),
      surveyorNames: input.surveyorNames,
      existingCondition: input.existingCondition,
      recommendation: input.recommendation ?? null,
      latitude: coordinate(input.latitude),
      longitude: coordinate(input.longitude),
      notes: input.notes ?? null,
    };

    const existing = await tx.survey.findUnique({
      where: { projectId },
      select: { id: true, version: true },
    });

    let surveyId: string;
    if (existing) {
      const updated = await tx.survey.updateMany({
        where: { id: existing.id, version: input.version },
        data: { ...values, version: { increment: 1 } },
      });
      if (updated.count === 0) throw versionConflict();
      surveyId = existing.id;
    } else {
      surveyId = (
        await tx.survey.create({
          data: { projectId, ...values },
          select: { id: true },
        })
      ).id;
    }

    const groups: { ids: readonly string[]; kind: FileKind }[] = [
      { ids: input.photoFileIds, kind: "PROGRESS_PHOTO" },
      { ids: input.documentFileIds, kind: "DOCUMENT" },
      { ids: input.spatialFileIds, kind: "SPATIAL_DATA" },
    ];
    for (const group of groups) {
      await attachFiles(tx, {
        fileIds: group.ids,
        projectId,
        ownerType: OWNER_TYPE,
        ownerId: surveyId,
        expectedKind: group.kind,
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "Survey",
      entityId: surveyId,
      action: existing ? "UPDATE" : "CREATE",
      after: {
        surveyorNames: values.surveyorNames,
        photos: input.photoFileIds.length,
        documents: input.documentFileIds.length,
        spatial: input.spatialFileIds.length,
      },
    });

    return { id: surveyId, version: existing ? input.version + 1 : 1 };
  });
}
