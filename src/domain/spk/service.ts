import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { prisma } from "@/infra/db";
import { decimal } from "@/infra/decimal";
import { writeAudit } from "@/domain/audit/service";
import {
  requireMutableProject,
  autoTransitionProject,
} from "@/domain/project-transition/service";
import { DomainError } from "@/shared/errors";
import type {
  CreateSpkInput,
  UpdateSpkInput,
  ReleaseSpkInput,
  CancelSpkInput,
} from "@/shared/schemas/procurement";

const spkAuditSelect = {
  id: true,
  number: true,
  date: true,
  value: true,
  status: true,
  releasedDate: true,
  cancelledDate: true,
  cancelReason: true,
  version: true,
} as const;

/** AC-38: SPK swakelola hanya vendor INTERNAL. SPK swakelola pertama → PROCUREMENT. */
async function assertSwakelolaVendor(tx: Tx, vendorId: string): Promise<void> {
  const vendor = await tx.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, type: true },
  });
  if (!vendor || vendor.type !== "INTERNAL") {
    throw new DomainError(
      "FORBIDDEN_ROLE",
      "SPK swakelola hanya boleh diberikan kepada vendor internal.",
    );
  }
}

/** Buat SPK: DRAFT; tender butuh pemenang; swakelola butuh vendor INTERNAL + plan fisik. */
export async function createSpk(
  workItemId: string,
  input: CreateSpkInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        projectId: true,
        project: { select: { id: true, status: true } },
        type: true,
        spks: {
          select: { status: true },
          where: { status: "RELEASED" },
        },
      },
    });
    if (!workItem) {
      throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
    }

    await requireMutableProject(tx, workItem.projectId);

    let tenderAttemptId: string | null = null;

    if (workItem.type === "TENDER_CONTRACT") {
      const attempt = await tx.tenderAttempt.findFirst({
        where: { workItemId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
        select: { id: true, winnerVendorId: true, winnerNameSnapshot: true },
      });
      if (!attempt || !attempt.winnerVendorId) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Tender attempt harus punya pemenang sebelum SPK dibuat.",
        );
      }
      tenderAttemptId = attempt.id;
      if (input.vendorId !== attempt.winnerVendorId) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Vendor SPK harus sama dengan pemenang tender attempt.",
        );
      }
    } else if (workItem.type === "SWAKELOLA") {
      await assertSwakelolaVendor(tx, input.vendorId);
    }

    const activeSpks = workItem.spks.length;

    // Nomor SPK otomatis bila tidak dikirim; sinonim nonaktif.
    const created = await tx.spk.create({
      data: {
        workItemId,
        tenderAttemptId,
        vendorId: input.vendorId,
        number: input.number,
        date: new Date(input.date),
        value:
          input.value === undefined || input.value === null
            ? null
            : decimal(input.value),
        status: "DRAFT",
        releasedDate: input.releasedDate ? new Date(input.releasedDate) : null,
      },
      select: spkAuditSelect,
    });

    // SPK swakelola pertama → PROCUREMENT (AC-38).
    if (workItem.type === "SWAKELOLA" && activeSpks === 0) {
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
      entityType: "Spk",
      entityId: created.id,
      action: "CREATE",
      after: { ...created, value: created.value?.toString() ?? null },
    });

    return created;
  });
}

/** Ubah SPK hanya DRAFT. */
export async function updateSpk(
  spkId: string,
  input: UpdateSpkInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const spk = await tx.spk.findUnique({
      where: { id: spkId },
      select: {
        id: true,
        workItemId: true,
        status: true,
        value: true,
        releasedDate: true,
        version: true,
        workItem: { select: { projectId: true, type: true } },
      },
    });
    if (!spk) {
      throw new DomainError("NOT_FOUND", "SPK tidak ditemukan.");
    }
    if (spk.status !== "DRAFT") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Hanya SPK DRAFT yang bisa diubah.",
      );
    }

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (input.number !== undefined) data.number = input.number;
    if (input.date !== undefined)
      data.date = input.date === null ? null : new Date(input.date);
    if (input.vendorId !== undefined) data.vendorId = input.vendorId;
    if (input.value !== undefined)
      data.value = input.value === null ? null : decimal(input.value);
    if (input.releasedDate !== undefined)
      data.releasedDate = input.releasedDate
        ? new Date(input.releasedDate)
        : null;

    const updated = await tx.spk.updateMany({
      where: { id: spkId, version: spk.version },
      data,
    });
    if (updated.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "SPK sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    const after = await tx.spk.findUniqueOrThrow({
      where: { id: spkId },
      select: spkAuditSelect,
    });

    await writeAudit(tx, {
      actorId,
      projectId: spk.workItem.projectId,
      entityType: "Spk",
      entityId: spkId,
      action: "UPDATE",
      before: {
        ...spk,
        value: spk.value?.toString() ?? null,
      },
      after: {
        ...after,
        value: after.value?.toString() ?? null,
      },
    });

    return after;
  });
}

/** AC-37: Release pertama → attempt COMPLETED, actualEnd = tanggal release. Boleh > 1 SPK aktif. */
export async function releaseSpk(
  spkId: string,
  input: ReleaseSpkInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const spk = await tx.spk.findUnique({
      where: { id: spkId },
      select: {
        id: true,
        workItemId: true,
        tenderAttemptId: true,
        status: true,
        releasedDate: true,
        version: true,
        workItem: { select: { projectId: true, type: true } },
      },
    });
    if (!spk) {
      throw new DomainError("NOT_FOUND", "SPK tidak ditemukan.");
    }
    if (spk.status !== "DRAFT") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Hanya SPK DRAFT yang bisa direlease.",
      );
    }

    const released = await tx.spk.updateMany({
      where: { id: spkId, version: spk.version },
      data: {
        status: "RELEASED",
        releasedDate: new Date(input.releasedDate),
        version: { increment: 1 },
      },
    });
    if (released.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "SPK sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    // Release pertama pada attempt → attempt COMPLETED, actualEnd = tanggal release (AC-37).
    if (spk.tenderAttemptId) {
      const existingReleased = await tx.spk.findFirst({
        where: {
          tenderAttemptId: spk.tenderAttemptId,
          status: "RELEASED",
          id: { not: spkId },
        },
        select: { id: true },
      });
      if (!existingReleased) {
        await tx.tenderAttempt.updateMany({
          where: { id: spk.tenderAttemptId },
          data: {
            status: "COMPLETED",
            actualEnd: new Date(input.releasedDate),
          },
        });
      }
    }

    // Swakelola release pertama → kunci baseline fisik (AC-38). Tindakan kunci
    // dilakukan oleh pemanggil F4 (ScheduleBaseline.lockedAt).

    await writeAudit(tx, {
      actorId,
      projectId: spk.workItem.projectId,
      entityType: "Spk",
      entityId: spkId,
      action: "UPDATE",
      before: { status: spk.status, releasedDate: spk.releasedDate },
      after: { status: "RELEASED", releasedDate: new Date(input.releasedDate) },
    });

    return { id: spkId, status: "RELEASED" };
  });
}

/**
 * AC-39: Batal SPK. Jika fisik BERJALAN dan tidak ada SPK RELEASED aktif lain →
 * fisik JEDA_SPK_BATAL, buka PhysicalPause, beku EWS fisik.
 */
export async function cancelSpk(
  spkId: string,
  input: CancelSpkInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const spk = await tx.spk.findUnique({
      where: { id: spkId },
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
    if (!spk) {
      throw new DomainError("NOT_FOUND", "SPK tidak ditemukan.");
    }
    if (spk.status !== "RELEASED" && spk.status !== "DRAFT") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Hanya SPK DRAFT atau RELEASED yang bisa dibatalkan.",
      );
    }

    const cancelled = await tx.spk.updateMany({
      where: { id: spkId, version: spk.version },
      data: {
        status: "BATAL",
        cancelledDate: new Date(input.cancelledDate),
        cancelReason: input.cancelReason,
        version: { increment: 1 },
      },
    });
    if (cancelled.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "SPK sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    // Jika fisik berjalan dan tidak ada SPK RELEASED aktif lain → JEDA_SPK_BATAL.
    if (spk.status === "RELEASED") {
      const physicalProcess = await tx.physicalProcess.findUnique({
        where: { workItemId: spk.workItemId },
        select: { id: true, status: true },
      });
      if (physicalProcess && physicalProcess.status === "BERJALAN") {
        const activeReleased = await tx.spk.count({
          where: {
            workItemId: spk.workItemId,
            status: "RELEASED",
            id: { not: spkId },
          },
        });
        if (activeReleased === 0) {
          await tx.physicalProcess.update({
            where: { id: physicalProcess.id },
            data: { status: "JEDA_SPK_BATAL" },
          });
          await tx.physicalPause.create({
            data: {
              physicalProcessId: physicalProcess.id,
              startDate: new Date(input.cancelledDate),
              triggerSpkId: spkId,
            },
          });
          // EWS fisik dibeku - ditangani oleh service progress-ews di F4.
        }
      }
    }

    await writeAudit(tx, {
      actorId,
      projectId: spk.workItem.projectId,
      entityType: "Spk",
      entityId: spkId,
      action: "UPDATE",
      before: {
        status: spk.status,
        cancelledDate: spk.cancelledDate,
        cancelReason: spk.cancelReason,
      },
      after: {
        status: "BATAL",
        cancelledDate: new Date(input.cancelledDate),
        cancelReason: input.cancelReason,
      },
      reason: input.cancelReason,
    });

    return { id: spkId, status: "BATAL" };
  });
}

/** GET /api/work-items/{id}/spks - daftar semua SPK Pekerjaan termasuk yang batal. */
export async function listSpks(workItemId: string) {
  return prisma.spk.findMany({
    where: { workItemId },
    select: {
      id: true,
      number: true,
      date: true,
      value: true,
      status: true,
      releasedDate: true,
      cancelledDate: true,
      cancelReason: true,
      version: true,
      vendor: { select: { id: true, name: true, type: true } },
      tenderAttempt: { select: { attemptNo: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
