import { writeAudit } from "@/domain/audit/service";
import { assertDecisionAllowed } from "@/domain/afce/duration";
import { attachFiles } from "@/domain/files/links";
import {
  autoTransitionProject,
  requireMutableProject,
} from "@/domain/project-transition/service";
import { withTransaction } from "@/infra/tx";
import {
  businessDateIso,
  parseBusinessDate,
  todayBusinessDateIso,
} from "@/shared/date";
import { DomainError } from "@/shared/errors";
import type { ApprovalDecisionInput } from "@/shared/schemas/afce";

type LevelRow = {
  id: string;
  levelNo: number;
  positionId: string;
  positionNameSnapshot: string;
  record: { result: "APPROVED" | "DITOLAK"; decisionDate: Date } | null;
};

type DocumentRow = {
  id: string;
  projectId: string;
  status: string;
  basisAmount?: never;
  approvalEmailDate: Date;
  levels: LevelRow[];
};

/**
 * AC-21, AC-23, AC-24: keputusan dicatat dari SAP oleh user. Level terakhir Approved membuat
 * proyek AFCE_AR_APPROVED dan BudgetEntry INITIAL; satu level Ditolak membuat dokumen DITOLAK
 * dan proyek kembali ke RAB_READY sehingga attempt baru bisa dibuat dengan BOQ tersalin.
 */
export async function recordDecision(
  levelId: string,
  input: ApprovalDecisionInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const level = await tx.approvalLevelSnapshot.findUnique({
      where: { id: levelId },
      select: {
        id: true,
        levelNo: true,
        positionNameSnapshot: true,
        afceAttempt: {
          select: {
            id: true,
            projectId: true,
            status: true,
            basisAmount: true,
            approvalEmailDate: true,
            levels: {
              select: {
                id: true,
                levelNo: true,
                positionId: true,
                positionNameSnapshot: true,
                record: { select: { result: true, decisionDate: true } },
              },
              orderBy: { levelNo: "asc" },
            },
          },
        },
        arSupplement: {
          select: {
            id: true,
            projectId: true,
            status: true,
            amount: true,
            date: true,
            approvalEmailDate: true,
            levels: {
              select: {
                id: true,
                levelNo: true,
                positionId: true,
                positionNameSnapshot: true,
                record: { select: { result: true, decisionDate: true } },
              },
              orderBy: { levelNo: "asc" },
            },
          },
        },
      },
    });
    if (!level)
      throw new DomainError("NOT_FOUND", "Level approval tidak ditemukan.");

    const document = (level.afceAttempt ??
      level.arSupplement) as DocumentRow | null;
    if (!document) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Level ini tidak terhubung ke dokumen AFCE atau AR tambahan.",
      );
    }
    if (document.status !== "DIAJUKAN") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Dokumen belum diajukan sehingga keputusan belum bisa dicatat.",
      );
    }

    const current = document.levels.find((row) => row.id === levelId);
    if (!current) {
      throw new DomainError("NOT_FOUND", "Level approval tidak ditemukan.");
    }
    if (current.record) {
      throw new DomainError(
        "ACTIVE_CONFLICT",
        `Level ${current.levelNo} sudah punya keputusan yang tercatat.`,
      );
    }

    const previousDecisions = document.levels.filter(
      (row) => row.levelNo < current.levelNo,
    );

    // AC-21: level N baru boleh diputuskan setelah semua level sebelumnya punya keputusan.
    const undecided = previousDecisions.find((row) => !row.record);
    if (undecided) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Level ${undecided.levelNo} ${undecided.positionNameSnapshot} belum diputuskan.`,
      );
    }

    assertDecisionAllowed({
      decisionDate: input.decisionDate,
      today: todayBusinessDateIso(),
      approvalEmailDate: businessDateIso(document.approvalEmailDate),
      previousDecisions: previousDecisions.map((row) => ({
        result: row.record?.result ?? "APPROVED",
        decisionDate: row.record?.decisionDate ?? new Date(0),
      })),
    });

    await requireMutableProject(tx, document.projectId);

    if (input.evidenceFileId) {
      await attachFiles(tx, {
        fileIds: [input.evidenceFileId],
        projectId: document.projectId,
        ownerType: level.afceAttempt ? "ApprovalRecord" : "ArApprovalRecord",
        ownerId: levelId,
        expectedKind: "APPROVAL_EVIDENCE",
      });
    }

    const decisionDate = parseBusinessDate(input.decisionDate);
    await tx.approvalRecord.create({
      data: {
        levelSnapshotId: levelId,
        result: input.result,
        approverName: input.approverName,
        decisionDate,
        notes: input.notes ?? null,
        recordedById: actorId,
      },
    });

    await writeAudit(tx, {
      actorId,
      projectId: document.projectId,
      entityType: "ApprovalRecord",
      entityId: levelId,
      action: "CREATE",
      reason: `Level ${current.levelNo} ${current.positionNameSnapshot}`,
      after: {
        result: input.result,
        approverName: input.approverName,
        decisionDate: input.decisionDate,
      },
    });

    const isLastLevel = document.levels.at(-1)?.id === levelId;
    const rejected = input.result === "DITOLAK";

    if (level.afceAttempt) {
      const attempt = level.afceAttempt;
      if (rejected) {
        await tx.afceAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "DITOLAK",
            decidedDate: decisionDate,
            version: { increment: 1 },
          },
        });
        await autoTransitionProject(tx, {
          projectId: attempt.projectId,
          from: "WAITING_AFCE_AR",
          to: "RAB_READY",
          actorId: null,
          reason: `Level ${current.levelNo} ditolak`,
        });
      } else if (isLastLevel) {
        await tx.afceAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "APPROVED",
            decidedDate: decisionDate,
            version: { increment: 1 },
          },
        });
        await autoTransitionProject(tx, {
          projectId: attempt.projectId,
          from: "WAITING_AFCE_AR",
          to: "AFCE_AR_APPROVED",
          actorId: null,
          reason: "Seluruh level AFCE disetujui",
        });
        // AC-24: anggaran resmi INITIAL sebesar nilai AFCE; anggaran rencana tetap.
        await tx.budgetEntry.create({
          data: {
            projectId: attempt.projectId,
            type: "INITIAL",
            amount: attempt.basisAmount,
            effectiveDate: decisionDate,
            createdById: actorId,
          },
        });
      }
    } else if (level.arSupplement) {
      const supplement = level.arSupplement;
      if (rejected) {
        await tx.arSupplement.update({
          where: { id: supplement.id },
          data: {
            status: "DITOLAK",
            decidedDate: decisionDate,
            version: { increment: 1 },
          },
        });
      } else if (isLastLevel) {
        await tx.arSupplement.update({
          where: { id: supplement.id },
          data: {
            status: "APPROVED",
            decidedDate: decisionDate,
            version: { increment: 1 },
          },
        });
        // AC-25: AR tambahan menambah anggaran tanpa mengubah status proyek.
        await tx.budgetEntry.create({
          data: {
            projectId: supplement.projectId,
            type: "AR_SUPPLEMENT",
            amount: supplement.amount,
            arSupplementId: supplement.id,
            effectiveDate: decisionDate,
            createdById: actorId,
          },
        });
      }
    }

    const project = await tx.project.findUniqueOrThrow({
      where: { id: document.projectId },
      select: { status: true },
    });
    return { levelId, result: input.result, projectStatus: project.status };
  });
}
