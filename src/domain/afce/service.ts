import { versionConflict, writeAudit } from "@/domain/audit/service";
import { replaceLevels, syncLevelsFromTier } from "@/domain/afce/levels";
import { findTierForAmount, tierNotFound } from "@/domain/afce/queries";
import {
  autoTransitionProject,
  requireMutableProject,
  transitionProject,
} from "@/domain/project-transition/service";
import { decimal, sumDecimal, ZERO } from "@/infra/decimal";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { parseBusinessDate } from "@/shared/date";
import { DomainError } from "@/shared/errors";
import type {
  CreateAfceAttemptInput,
  ReplaceBoqInput,
  UpdateAfceAttemptInput,
} from "@/shared/schemas/afce";
import { PROJECT_STATUS_LABEL } from "@/shared/project-status";

type AttemptState = {
  id: string;
  projectId: string;
  status: "DRAFT" | "DIAJUKAN" | "APPROVED" | "DITOLAK";
  basisAmount: ReturnType<typeof decimal>;
  matrixTierId: string | null;
  version: number;
};

const boqSelect = {
  lineNo: true,
  buildingName: true,
  activityName: true,
  amount: true,
  notes: true,
} as const;

/** Setelah diajukan nilai dan level terkunci; hanya attempt DRAFT yang boleh diubah. */
async function requireDraftAttempt(
  tx: Tx,
  attemptId: string,
): Promise<AttemptState> {
  const attempt = await tx.afceAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      projectId: true,
      status: true,
      basisAmount: true,
      matrixTierId: true,
      version: true,
    },
  });
  if (!attempt)
    throw new DomainError("NOT_FOUND", "Attempt AFCE tidak ditemukan.");
  if (attempt.status !== "DRAFT") {
    throw new DomainError(
      "PRECONDITION_FAILED",
      `Attempt AFCE sudah diajukan sehingga isinya terkunci.`,
    );
  }
  return attempt;
}

async function tierLevelsOf(tx: Tx, tierId: string) {
  return tx.approvalMatrixTierLevel.findMany({
    where: { tierId },
    select: {
      levelNo: true,
      positionId: true,
      position: { select: { name: true } },
    },
  });
}

/**
 * AC-23: attempt baru boleh menyalin BOQ attempt ditolak lewat `copyFromAttemptId`; attempt
 * lama tidak pernah diubah sehingga tetap utuh.
 */
export async function createAttempt(
  projectId: string,
  input: CreateAfceAttemptInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const project = await requireMutableProject(tx, projectId);
    if (project.status !== "SURVEY" && project.status !== "RAB_READY") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `AFCE hanya bisa dibuat saat proyek Survei atau RAB siap, bukan "${
          PROJECT_STATUS_LABEL[project.status]
        }".`,
      );
    }

    const active = await tx.afceAttempt.count({
      where: { projectId, status: { in: ["DRAFT", "DIAJUKAN"] } },
    });
    if (active > 0) {
      throw new DomainError(
        "ACTIVE_CONFLICT",
        "Masih ada attempt AFCE yang aktif. Selesaikan atau batalkan dulu.",
      );
    }

    const last = await tx.afceAttempt.findFirst({
      where: { projectId },
      orderBy: { attemptNo: "desc" },
      select: { attemptNo: true },
    });

    let copied: { activityName: string; amount: ReturnType<typeof decimal> }[] =
      [];
    if (input.copyFromAttemptId) {
      const source = await tx.afceAttempt.findUnique({
        where: { id: input.copyFromAttemptId },
        select: { projectId: true, boqItems: { select: boqSelect } },
      });
      if (!source || source.projectId !== projectId) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Attempt sumber BOQ tidak ditemukan pada proyek ini.",
        );
      }
      copied = source.boqItems.map((item) => ({
        activityName: item.activityName,
        amount: item.amount,
      }));
    }

    const created = await tx.afceAttempt.create({
      data: {
        projectId,
        attemptNo: (last?.attemptNo ?? 0) + 1,
        basisAmount: copied.reduce(
          (total, item) => total.plus(item.amount),
          ZERO(),
        ),
        boqItems: {
          create: copied.map((item, index) => ({
            lineNo: index + 1,
            activityName: item.activityName,
            amount: item.amount,
          })),
        },
      },
      select: { id: true, attemptNo: true, status: true, version: true },
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "AfceAttempt",
      entityId: created.id,
      action: "CREATE",
      after: { attemptNo: created.attemptNo, copiedBoqLines: copied.length },
    });
    return created;
  });
}

/** AC-16: `rabReady` saat proyek masih SURVEY memindahkan proyek ke RAB_READY. */
export async function updateAttempt(
  attemptId: string,
  input: UpdateAfceAttemptInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await requireDraftAttempt(tx, attemptId);
    const project = await requireMutableProject(tx, attempt.projectId);

    const updated = await tx.afceAttempt.updateMany({
      where: { id: attemptId, version: input.version },
      data: {
        ...(input.afceNumber === undefined
          ? {}
          : { afceNumber: input.afceNumber }),
        ...(input.documentDate === undefined
          ? {}
          : {
              documentDate: input.documentDate
                ? parseBusinessDate(input.documentDate)
                : null,
            }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.rabReady === undefined ? {} : { rabReady: input.rabReady }),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    if (input.rabReady && project.status === "SURVEY") {
      await autoTransitionProject(tx, {
        projectId: attempt.projectId,
        from: "SURVEY",
        to: "RAB_READY",
        actorId: null,
        reason: "RAB ditandai siap",
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId: attempt.projectId,
      entityType: "AfceAttempt",
      entityId: attemptId,
      action: "UPDATE",
      before: { version: attempt.version },
      after: {
        afceNumber: input.afceNumber,
        rabReady: input.rabReady,
      },
    });
    return { id: attemptId };
  });
}

/**
 * AC-17: nilai AFCE = total BOQ, dihitung ulang selama DRAFT. Bila total memindahkan nilai ke
 * tier lain, level disalin ulang hanya bila level belum diubah manual (D-53).
 */
export async function replaceBoq(
  attemptId: string,
  input: ReplaceBoqInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await requireDraftAttempt(tx, attemptId);
    const before = await tx.boqItem.findMany({
      where: { afceAttemptId: attemptId },
      select: boqSelect,
      orderBy: { lineNo: "asc" },
    });

    const basisAmount = sumDecimal(
      input.items.map((item) => decimal(item.amount)),
    );
    const tier = basisAmount.greaterThan(0)
      ? await findTierForAmount(basisAmount)
      : null;

    const updated = await tx.afceAttempt.updateMany({
      where: { id: attemptId, version: input.version },
      data: {
        basisAmount,
        ...(tier && tier.id !== attempt.matrixTierId
          ? { matrixTierId: tier.id }
          : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    await tx.boqItem.deleteMany({ where: { afceAttemptId: attemptId } });
    await tx.boqItem.createMany({
      data: input.items.map((item, index) => ({
        afceAttemptId: attemptId,
        lineNo: index + 1,
        buildingName: item.buildingName ?? null,
        activityName: item.activityName,
        amount: decimal(item.amount),
        notes: item.notes ?? null,
      })),
    });

    if (tier && tier.id !== attempt.matrixTierId) {
      await syncLevelsFromTier(
        tx,
        { afceAttemptId: attemptId },
        attempt.matrixTierId,
        await tierLevelsOf(tx, tier.id),
      );
    }

    await writeAudit(tx, {
      actorId,
      projectId: attempt.projectId,
      entityType: "AfceAttempt",
      entityId: attemptId,
      action: "UPDATE",
      reason: "BOQ",
      before: { items: before },
      after: { lines: input.items.length, basisAmount: basisAmount.toFixed(2) },
    });
    return { id: attemptId, basisAmount: basisAmount.toFixed(2) };
  });
}

export async function setLevels(
  attemptId: string,
  positionIds: readonly string[],
  version: number,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await requireDraftAttempt(tx, attemptId);
    const updated = await tx.afceAttempt.updateMany({
      where: { id: attemptId, version },
      data: { version: { increment: 1 } },
    });
    if (updated.count === 0) throw versionConflict();
    await replaceLevels(
      tx,
      { afceAttemptId: attemptId },
      positionIds,
      actorId,
      attempt.projectId,
    );
    return { id: attemptId };
  });
}

/**
 * AC-20: pengajuan wajib tanggal pengajuan dan tanggal email; AC-17 mengunci nilai dan level
 * dengan mengubah status menjadi DIAJUKAN dan memindahkan proyek ke WAITING_AFCE_AR.
 */
export async function submitAttempt(
  attemptId: string,
  input: { submittedDate: string; approvalEmailDate: string; version: number },
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await requireDraftAttempt(tx, attemptId);
    const project = await requireMutableProject(tx, attempt.projectId);
    if (project.status !== "RAB_READY") {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Tandai RAB siap sebelum mengajukan AFCE.",
      );
    }
    const boqCount = await tx.boqItem.count({
      where: { afceAttemptId: attemptId },
    });
    if (boqCount === 0) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Isi minimal satu baris BOQ sebelum mengajukan AFCE.",
      );
    }
    const tier = await findTierForAmount(attempt.basisAmount);
    if (!tier) throw tierNotFound(attempt.basisAmount);

    if (tier.id !== attempt.matrixTierId) {
      await tx.afceAttempt.update({
        where: { id: attemptId },
        data: { matrixTierId: tier.id },
      });
      await syncLevelsFromTier(
        tx,
        { afceAttemptId: attemptId },
        attempt.matrixTierId,
        await tierLevelsOf(tx, tier.id),
      );
    }
    const levelCount = await tx.approvalLevelSnapshot.count({
      where: { afceAttemptId: attemptId },
    });
    if (levelCount === 0) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Salin level approval dari matriks sebelum mengajukan AFCE.",
      );
    }

    const updated = await tx.afceAttempt.updateMany({
      where: { id: attemptId, version: input.version },
      data: {
        status: "DIAJUKAN",
        submittedDate: parseBusinessDate(input.submittedDate),
        approvalEmailDate: parseBusinessDate(input.approvalEmailDate),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    await writeAudit(tx, {
      actorId,
      projectId: attempt.projectId,
      entityType: "AfceAttempt",
      entityId: attemptId,
      action: "UPDATE",
      reason: "Pengajuan AFCE",
      before: { status: "DRAFT" },
      after: {
        status: "DIAJUKAN",
        submittedDate: input.submittedDate,
        approvalEmailDate: input.approvalEmailDate,
        basisAmount: attempt.basisAmount.toFixed(2),
      },
    });

    await transitionProject(tx, {
      projectId: attempt.projectId,
      from: "RAB_READY",
      to: "WAITING_AFCE_AR",
      actorId,
      reason: "AFCE diajukan",
    });
    return { id: attemptId, projectStatus: "WAITING_AFCE_AR" as const };
  });
}
