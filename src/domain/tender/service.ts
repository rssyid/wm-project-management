import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { writeAudit } from "@/domain/audit/service";
import {
  requireMutableProject,
  autoTransitionProject,
} from "@/domain/project-transition/service";
import { DomainError } from "@/shared/errors";
import type {
  CreateTenderAttemptInput,
  CancelTenderAttemptInput,
} from "@/shared/schemas/procurement";

const tenderAttemptAuditSelect = {
  id: true,
  attemptNo: true,
  status: true,
  actualStart: true,
  actualEnd: true,
  winnerVendorId: true,
  winnerNameSnapshot: true,
  cancelledDate: true,
  cancelReason: true,
  version: true,
} as const;

/** AC-35: Satu attempt aktif per Pekerjaan. Attempt batal tetap tampil; baru wajib USPK baru. */
async function assertNoActiveAttempt(
  tx: Tx,
  workItemId: string,
): Promise<void> {
  const active = await tx.tenderAttempt.findFirst({
    where: {
      workItemId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
    },
    select: { id: true, attemptNo: true },
  });
  if (active) {
    throw new DomainError(
      "ACTIVE_CONFLICT",
      `Pekerjaan sudah punya tender attempt #${active.attemptNo} yang aktif. Buat USPK baru untuk attempt berikutnya.`,
    );
  }
}

/** AC-34, AC-35: Buat tender attempt dengan USPK baru. USPK pertama → PROCUREMENT. */
export async function createTenderAttempt(
  workItemId: string,
  input: CreateTenderAttemptInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        projectId: true,
        project: { select: { id: true, status: true } },
        tenderAttempts: {
          select: { attemptNo: true },
          orderBy: { attemptNo: "desc" },
          take: 1,
        },
      },
    });
    if (!workItem) {
      throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
    }

    await requireMutableProject(tx, workItem.projectId);
    await assertNoActiveAttempt(tx, workItemId);

    const last = workItem.tenderAttempts[0];
    const attemptNo = (last?.attemptNo ?? 0) + 1;

    const attempt = await tx.tenderAttempt.create({
      data: {
        workItemId,
        attemptNo,
        status: "PLANNED",
        planTender: input.planTender ?? null,
        planPhysical: input.planPhysical ?? null,
      },
      select: tenderAttemptAuditSelect,
    });

    // USPK wajib baru per attempt (docs/01 §7).
    const { uspk: us } = input;
    const uspk = await tx.uspk.create({
      data: {
        number: us.number,
        date: new Date(us.date),
        createdById: actorId,
        tenderAttemptId: attempt.id,
      },
    });

    // Kunci baseline tender & fisik attempt saat dibuat (AC-34).
    // Baseline ditulis oleh pemanggil (F4); sini hanya mencatat intent.

    // USPK pertama untuk Pekerjaan → PROCUREMENT (AC-34).
    const isFirstAttempt = attemptNo === 1;
    if (isFirstAttempt) {
      await autoTransitionProject(tx, {
        projectId: workItem.projectId,
        from: "AFCE_AR_APPROVED",
        to: "PROCUREMENT",
        actorId,
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId: workItem.projectId,
      entityType: "TenderAttempt",
      entityId: attempt.id,
      action: "CREATE",
      after: { ...attempt, uspkId: uspk.id },
    });

    return { ...attempt, uspkId: uspk.id };
  });
}

/** Catat pemenang tender: vendor existing atau nama baru (AC-36). */
export async function setTenderWinner(
  attemptId: string,
  vendorId: string | null,
  vendorName: string | null,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await tx.tenderAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        workItemId: true,
        status: true,
        winnerVendorId: true,
        winnerNameSnapshot: true,
        version: true,
        workItem: { select: { projectId: true } },
      },
    });
    if (!attempt) {
      throw new DomainError("NOT_FOUND", "Tender attempt tidak ditemukan.");
    }
    if (attempt.status !== "PLANNED" && attempt.status !== "IN_PROGRESS") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Pemenang hanya bisa dicatat pada attempt PLANNED atau IN_PROGRESS.",
      );
    }

    let resolvedVendorId = vendorId;
    let resolvedNameSnapshot = attempt.winnerNameSnapshot;

    if (vendorName) {
      // Nama baru → vendor isComplete=false, disimpan sebagai snapshot (AC-36).
      const vendor = await tx.vendor.create({
        data: {
          name: vendorName,
          type: "EKSTERNAL",
          isComplete: false,
          isActive: true,
        },
        select: { id: true },
      });
      resolvedVendorId = vendor.id;
      resolvedNameSnapshot = vendorName;
    } else if (vendorId) {
      const vendor = await tx.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, name: true, isComplete: true },
      });
      if (!vendor) {
        throw new DomainError("NOT_FOUND", "Vendor tidak ditemukan.");
      }
      resolvedNameSnapshot = vendor.name;
    }

    const updated = await tx.tenderAttempt.updateMany({
      where: { id: attemptId, version: attempt.version },
      data: {
        winnerVendorId: resolvedVendorId ?? undefined,
        winnerNameSnapshot: resolvedNameSnapshot ?? undefined,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Attempt sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    await writeAudit(tx, {
      actorId,
      projectId: attempt.workItem.projectId,
      entityType: "TenderAttempt",
      entityId: attemptId,
      action: "UPDATE",
      before: {
        winnerVendorId: attempt.winnerVendorId,
        winnerNameSnapshot: attempt.winnerNameSnapshot,
      },
      after: {
        winnerVendorId: resolvedVendorId,
        winnerNameSnapshot: resolvedNameSnapshot,
      },
    });

    return {
      id: attemptId,
      winnerVendorId: resolvedVendorId,
      winnerNameSnapshot: resolvedNameSnapshot,
    };
  });
}

/** Batal tender attempt: tanggal + alasan; hanya PLANNED/IN_PROGRESS. */
export async function cancelTenderAttempt(
  attemptId: string,
  input: CancelTenderAttemptInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await tx.tenderAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        workItemId: true,
        status: true,
        cancelledDate: true,
        cancelReason: true,
        version: true,
        workItem: { select: { projectId: true } },
      },
    });
    if (!attempt) {
      throw new DomainError("NOT_FOUND", "Tender attempt tidak ditemukan.");
    }
    if (attempt.status === "COMPLETED") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Attempt COMPLETED tidak bisa dibatalkan. Batalkan SPK-nya instead.",
      );
    }
    if (attempt.status === "CANCELLED") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Attempt sudah dibatalkan sebelumnya.",
      );
    }

    const cancelled = await tx.tenderAttempt.updateMany({
      where: { id: attemptId, version: attempt.version },
      data: {
        status: "CANCELLED",
        cancelledDate: new Date(input.cancelledDate),
        cancelReason: input.cancelReason,
        version: { increment: 1 },
      },
    });
    if (cancelled.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Attempt sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    await writeAudit(tx, {
      actorId,
      projectId: attempt.workItem.projectId,
      entityType: "TenderAttempt",
      entityId: attemptId,
      action: "UPDATE",
      before: {
        status: attempt.status,
        cancelledDate: attempt.cancelledDate,
        cancelReason: attempt.cancelReason,
      },
      after: {
        status: "CANCELLED",
        cancelledDate: new Date(input.cancelledDate),
        cancelReason: input.cancelReason,
      },
      reason: input.cancelReason,
    });

    return { id: attemptId, status: "CANCELLED" };
  });
}
