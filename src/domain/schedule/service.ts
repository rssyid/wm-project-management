// docs/01 §4, §11: revisi jadwal dan kunci baseline. Setiap mutasi dalam transaksi
// dengan AuditLog. `Project.status` hanya diubah lewat project-transition (tidak di sini).
import { writeAudit, assertUpdated } from "@/domain/audit/service";
import {
  requireMutableProject,
  assertFieldInputAllowed,
} from "@/domain/project-transition/service";
import { withTransaction } from "@/infra/tx";
import { DomainError } from "@/shared/errors";

export type ScheduleBaselineInput = {
  plannedStart: string;
  plannedEnd: string;
};

export type ScheduleRevisionInput = {
  plannedStart: string;
  plannedEnd: string;
  reason: string;
};

/** AC-45: ubah plan baseline hanya sebelum dikunci (lockedAt null). */
export async function updateScheduleBaseline(
  baselineId: string,
  input: ScheduleBaselineInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const baseline = await tx.scheduleBaseline.findUnique({
      where: { id: baselineId },
      select: {
        id: true,
        plannedStart: true,
        plannedEnd: true,
        lockedAt: true,
        version: true,
      },
    });
    if (!baseline) {
      throw new DomainError("NOT_FOUND", "Baseline jadwal tidak ditemukan.");
    }
    if (baseline.lockedAt) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Baseline sudah dikunci; ubah jadwal lewat revisi dengan alasan.",
      );
    }

    const updated = await tx.scheduleBaseline.updateMany({
      where: { id: baselineId, version: baseline.version },
      data: {
        plannedStart: new Date(input.plannedStart),
        plannedEnd: new Date(input.plannedEnd),
        version: { increment: 1 },
      },
    });
    assertUpdated(updated.count);

    const after = await tx.scheduleBaseline.findUniqueOrThrow({
      where: { id: baselineId },
    });

    await writeAudit(tx, {
      actorId,
      entityType: "ScheduleBaseline",
      entityId: baselineId,
      action: "UPDATE",
      before: {
        plannedStart: baseline.plannedStart,
        plannedEnd: baseline.plannedEnd,
      },
      after: {
        plannedStart: after.plannedStart,
        plannedEnd: after.plannedEnd,
      },
      reason: "Ubah rencana jadwal sebelum kunci baseline",
    });

    return after;
  });
}

/** AC-46: buat revisi baseline setelah dikunci. Ditolak WAITING_BAST, terima ON_HOLD. */
export async function createScheduleRevision(
  baselineId: string,
  input: ScheduleRevisionInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const baseline = await tx.scheduleBaseline.findUnique({
      where: { id: baselineId },
      select: {
        id: true,
        lockedAt: true,
        tenderAttempt: {
          select: { workItem: { select: { projectId: true } } },
        },
        physicalProcess: {
          select: { workItem: { select: { projectId: true } } },
        },
        workPackage: { select: { projectId: true } },
        revisions: { orderBy: { revisionNo: "desc" }, take: 1 },
      },
    });
    if (!baseline) {
      throw new DomainError("NOT_FOUND", "Baseline jadwal tidak ditemukan.");
    }
    if (!baseline.lockedAt) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Belum ada baseline yang dikunci; ubah rencana secara langsung.",
      );
    }

    const projectId =
      baseline.tenderAttempt?.workItem.projectId ??
      baseline.physicalProcess?.workItem.projectId ??
      baseline.workPackage?.projectId;
    if (!projectId) {
      throw new DomainError(
        "NOT_FOUND",
        "Proyek terkait baseline tidak ditemukan.",
      );
    }

    const project = await requireMutableProject(tx, projectId);
    assertFieldInputAllowed(project);

    const lastRev = baseline.revisions[0];
    const nextNo = (lastRev?.revisionNo ?? 0) + 1;

    const created = await tx.scheduleRevision.create({
      data: {
        baselineId,
        revisionNo: nextNo,
        plannedStart: new Date(input.plannedStart),
        plannedEnd: new Date(input.plannedEnd),
        reason: input.reason,
        changedById: actorId,
      },
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "ScheduleRevision",
      entityId: created.id,
      action: "CREATE",
      after: {
        revisionNo: created.revisionNo,
        plannedStart: created.plannedStart,
        plannedEnd: created.plannedEnd,
        reason: created.reason,
      },
      reason: input.reason,
    });

    return created;
  });
}

/** Kunci baseline (pemicu F3: USPK/SPK/PR). Digunakan saat baseline pertama kali ditetapkan. */
export async function lockScheduleBaseline(
  baselineId: string,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const baseline = await tx.scheduleBaseline.findUnique({
      where: { id: baselineId },
      select: { id: true, lockedAt: true, version: true },
    });
    if (!baseline) {
      throw new DomainError("NOT_FOUND", "Baseline jadwal tidak ditemukan.");
    }
    if (baseline.lockedAt) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Baseline sudah dikunci sebelumnya.",
      );
    }

    const updated = await tx.scheduleBaseline.updateMany({
      where: { id: baselineId, version: baseline.version },
      data: {
        lockedAt: new Date(),
        lockedById: actorId,
        version: { increment: 1 },
      },
    });
    assertUpdated(updated.count);

    await writeAudit(tx, {
      actorId,
      entityType: "ScheduleBaseline",
      entityId: baselineId,
      action: "UPDATE",
      before: { lockedAt: null },
      after: { lockedAt: new Date(), lockedById: actorId },
      reason: "Kunci baseline jadwal",
    });

    return { id: baselineId };
  });
}
