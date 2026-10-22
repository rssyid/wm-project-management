// docs/01 §12, docs/04 §8: BAST — ajukan, verifikasi, batal. Setiap mutasi dalam
// transaksi dengan AuditLog.
import { writeAudit } from "@/domain/audit/service";
import {
  requireMutableProject,
  transitionProject,
} from "@/domain/project-transition/service";
import { withTransaction } from "@/infra/tx";
import type { Tx } from "@/infra/tx";
import { DomainError } from "@/shared/errors";

/** Cek semua proses fisik Pekerjaan TENDER/SWAKELOLA aktif sudah 100% (SELESAI). */
async function assertPhysicalAll100(tx: Tx, projectId: string): Promise<void> {
  const workItems = await tx.workItem.findMany({
    where: {
      projectId,
      cancelledAt: null,
      type: { in: ["TENDER_CONTRACT", "SWAKELOLA"] },
    },
    select: {
      id: true,
      physicalProcess: {
        select: { id: true, status: true },
      },
    },
  });

  if (workItems.length === 0) {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "Tidak ada Pekerjaan TENDER atau SWAKELOLA aktif. Ajukan BAST membutuhkan pekerjaan fisik 100%.",
    );
  }

  const unfinished = workItems.filter(
    (wi) => !wi.physicalProcess || wi.physicalProcess.status !== "SELESAI",
  );
  if (unfinished.length > 0) {
    throw new DomainError(
      "PRECONDITION_FAILED",
      `Fisik belum 100% pada ${unfinished.length} Pekerjaan. Selesaikan log progres sampai 100% sebelum mengajukan BAST.`,
    );
  }
}

/** AC-63: Ajukan BAST. Ditolak bila fisik < 100%; diterima walau belum lunas/material. */
export async function submitBast(
  projectId: string,
  number: string,
  date: Date | null,
  fileId: string,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const project = await requireMutableProject(tx, projectId);
    if (project.status !== "EXECUTION") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `BAST hanya bisa diajukan saat status "Pelaksanaan", bukan "${project.status}".`,
      );
    }

    await assertPhysicalAll100(tx, projectId);

    // Satu DIAJUKAN per proyek (partial unique index di DB sebagai cadangan).
    const existing = await tx.bastDocument.findFirst({
      where: { projectId, status: "DIAJUKAN" },
    });
    if (existing) {
      throw new DomainError(
        "ACTIVE_CONFLICT",
        "Sudah ada pengajuan BAST yang diajukan. Batalkan pengajuan lama terlebih dahulu atau verifikasi.",
      );
    }

    const bast = await tx.bastDocument.create({
      data: {
        projectId,
        number,
        date: date ?? new Date(),
        status: "DIAJUKAN",
        submittedById: actorId,
        submittedAt: new Date(),
      },
      select: { id: true, number: true, status: true, date: true, submittedAt: true },
    });

    await transitionProject(tx, {
      projectId,
      from: "EXECUTION",
      to: "WAITING_BAST",
      actorId,
      reason: "Ajukan BAST",
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "BastDocument",
      entityId: bast.id,
      action: "CREATE",
      after: { status: bast.status, number: bast.number },
      reason: "Ajukan BAST",
    });

    return { ...bast, projectStatus: "WAITING_BAST" };
  });
}

/** AC-65: Verifikasi BAST → COMPLETED. Semua mutasi sesudahnya → PROJECT_LOCKED. */
export async function verifyBast(bastId: string, actorId: string) {
  return withTransaction(async (tx) => {
    const bast = await tx.bastDocument.findUnique({
      where: { id: bastId },
      select: { id: true, projectId: true, status: true },
    });
    if (!bast) {
      throw new DomainError("NOT_FOUND", "BAST tidak ditemukan.");
    }
    if (bast.status !== "DIAJUKAN") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `BAST sudah ${bast.status.toLowerCase()}, tidak dapat diverifikasi lagi.`,
      );
    }

    const project = await requireMutableProject(tx, bast.projectId);
    if (project.status !== "WAITING_BAST") {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Proyek tidak sedang menunggu BAST.",
      );
    }

    const updated = await tx.bastDocument.updateMany({
      where: { id: bastId, status: "DIAJUKAN" },
      data: {
        status: "TERVERIFIKASI",
        verifiedById: actorId,
        verifiedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Data sudah diubah orang lain. Muat ulang halaman lalu ulangi.",
      );
    }

    await transitionProject(tx, {
      projectId: bast.projectId,
      from: "WAITING_BAST",
      to: "COMPLETED",
      actorId,
      reason: "Verifikasi BAST",
    });

    await writeAudit(tx, {
      actorId,
      projectId: bast.projectId,
      entityType: "BastDocument",
      entityId: bastId,
      action: "UPDATE",
      before: { status: bast.status },
      after: { status: "TERVERIFIKASI" },
      reason: "Verifikasi BAST",
    });

    return { id: bast.id, status: "TERVERIFIKASI", projectStatus: "COMPLETED" };
  });
}

/** AC-66: Batal pengajuan BAST → EXECUTION; dokumen tersimpan DIBATALKAN. */
export async function cancelBast(
  bastId: string,
  reason: string,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const bast = await tx.bastDocument.findUnique({
      where: { id: bastId },
      select: { id: true, projectId: true, status: true },
    });
    if (!bast) {
      throw new DomainError("NOT_FOUND", "BAST tidak ditemukan.");
    }
    if (bast.status !== "DIAJUKAN") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `BAST sudah ${bast.status.toLowerCase()}, tidak dapat dibatalkan lagi.`,
      );
    }

    const project = await requireMutableProject(tx, bast.projectId);
    if (project.status !== "WAITING_BAST") {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Proyek tidak sedang menunggu BAST.",
      );
    }

    const updated = await tx.bastDocument.updateMany({
      where: { id: bastId, status: "DIAJUKAN" },
      data: {
        status: "DIBATALKAN",
        cancelledById: actorId,
        cancelledAt: new Date(),
        cancelReason: reason,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Data sudah diubah orang lain. Muat ulang halaman lalu ulangi.",
      );
    }

    await transitionProject(tx, {
      projectId: bast.projectId,
      from: "WAITING_BAST",
      to: "EXECUTION",
      actorId,
      reason: `Batalkan pengajuan BAST: ${reason}`,
    });

    await writeAudit(tx, {
      actorId,
      projectId: bast.projectId,
      entityType: "BastDocument",
      entityId: bastId,
      action: "UPDATE",
      before: { status: bast.status },
      after: { status: "DIBATALKAN", cancelReason: reason },
      reason: "Batalkan pengajuan BAST",
    });

    return { id: bast.id, status: "DIBATALKAN", projectStatus: "EXECUTION" };
  });
}
