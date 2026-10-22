// docs/01 §12, docs/04 §11: soft delete, restore, purge proyek. Setiap mutasi dalam
// transaksi dengan AuditLog. Tabel riwayat (ProjectStatusHistory, BudgetEntry,
// ApprovalRecord, ScheduleRevision, PackageDelivery, PackageDeliveryItem, AuditLog,
// ProjectTombstone) tidak dihapus — trigger DB melindunginya.
import { writeAudit } from "@/domain/audit/service";
import { withTransaction } from "@/infra/tx";
import type { Tx } from "@/infra/tx";
import { removeObject } from "@/infra/r2";
import { DomainError } from "@/shared/errors";
import { PROJECT_STATUS_LABEL } from "@/shared/project-status";

/** Non-terminal proyek bisa di-soft delete; riwayat tetap terbaca. */
export async function softDeleteProject(
  projectId: string,
  reason: string,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true, name: true, status: true, deletedAt: true },
    });
    if (!project) {
      throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
    }
    if (project.deletedAt) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Proyek sudah terhapus sebelumnya.",
      );
    }
    if (project.status === "COMPLETED" || project.status === "CANCELLED") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Proyek sudah ${PROJECT_STATUS_LABEL[project.status]} sehingga tidak bisa dihapus.`,
      );
    }

    const before = { code: project.code, name: project.name, status: project.status };

    const updated = await tx.project.updateMany({
      where: { id: projectId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedById: actorId,
        deleteReason: reason,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DomainError("VERSION_CONFLICT", "Data sudah diubah orang lain.");
    }

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "Project",
      entityId: projectId,
      action: "DELETE",
      before,
      after: { deletedAt: new Date(), deleteReason: reason },
      reason: "Soft delete proyek",
    });

    return { id: projectId, code: project.code };
  });
}

/** Restore proyek ter-soft delete. */
export async function restoreProject(projectId: string, actorId: string) {
  return withTransaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true, deletedAt: true },
    });
    if (!project) {
      throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
    }
    if (!project.deletedAt) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Proyek tidak sedang terhapus sehingga tidak dapat dipulihkan.",
      );
    }

    const updated = await tx.project.updateMany({
      where: { id: projectId, deletedAt: { not: null } },
      data: {
        deletedAt: null,
        deletedById: null,
        deleteReason: null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DomainError("VERSION_CONFLICT", "Data sudah diubah orang lain.");
    }

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "Project",
      entityId: projectId,
      action: "UPDATE",
      before: { deletedAt: project.deletedAt },
      after: { deletedAt: null },
      reason: "Restore proyek",
    });

    return { id: projectId, code: project.code };
  });
}

/**
 * Purge hanya untuk proyek ter-soft delete dengan konfirmasi kode.
 * Tabel riwayat dan AuditLog tetap; data anak dan file R2 dihapus; kode tidak dipakai ulang.
 */
export async function purgeProject(
  projectId: string,
  code: string,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    // SET LOCAL app.allow_purge = 'on' berlaku selama transaksi ini untuk bypass
    // trigger immutable pada DELETE (tabel riwayat akan di-RETURN OLD, tidak terhapus).
    await tx.$executeRaw`SET LOCAL app.allow_purge = 'on'`;

    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        deletedAt: true,
      },
    });
    if (!project) {
      throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
    }
    if (!project.deletedAt) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Purge hanya diperbolehkan untuk proyek yang sudah di-soft delete.",
      );
    }
    if (project.code !== code) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Kode proyek tidak cocok. Purge dibatalkan.",
      );
    }

    // Buat tombstone sebelum data dihapus.
    await tx.projectTombstone.create({
      data: {
        projectId: project.id,
        code: project.code,
        name: project.name,
        purgedById: actorId,
        reason: "Purge proyek",
      },
    });

    // Hapus data anak secara eksplisit (dari daun ke akar). Tabel riwayat dengan
    // trigger immutable tidak akan terhapus walau DELETE dipanggil (allow_purge=on).
    await deleteProjectChildren(tx, projectId);

    // Hapus FileObject yang terkait proyek (berkas R2 dihapus setelah commit).
    const files = await tx.fileObject.findMany({
      where: { projectId },
      select: { id: true, key: true },
    });
    await tx.fileObject.deleteMany({ where: { projectId } });

    // Hapus baris proyek itu sendiri.
    const deleted = await tx.project.delete({
      where: { id: projectId },
      select: { id: true, code: true },
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "Project",
      entityId: projectId,
      action: "DELETE",
      before: { code: project.code, name: project.name },
      after: null,
      reason: "Purge proyek",
    });

    // File R2 dihapus di luar transaksi (setelah commit) melalui caller.
    return { id: deleted.id, code: deleted.code, fileKeys: files.map((f) => f.key) };
  });
}

/** Hapus semua baris anak proyek dalam urutan dependensi (daun ke akar). */
async function deleteProjectChildren(tx: Tx, projectId: string) {
  // Leaf / independen
  await tx.heavyEquipmentUsage.deleteMany({
    where: { progressLog: { physicalProcess: { workItem: { projectId } } } },
  });
  await tx.packageDeliveryItem.deleteMany({
    where: { delivery: { workPackage: { projectId } } },
  });
  await tx.scheduleRevision.deleteMany({
    where: { baseline: { workPackageId: { not: null } } },
  });
  await tx.scheduleRevision.deleteMany({
    where: { baseline: { physicalProcessId: { not: null } } },
  });
  await tx.scheduleRevision.deleteMany({
    where: { baseline: { tenderAttemptId: { not: null } } },
  });
  await tx.uspk.deleteMany({
    where: { tenderAttempt: { workItem: { projectId } } },
  });
  await tx.physicalPause.deleteMany({
    where: { physicalProcess: { workItem: { projectId } } },
  });
  await tx.boqItem.deleteMany({
    where: { afceAttempt: { projectId } },
  });

  // Tabel tengah
  await tx.packageDelivery.deleteMany({ where: { workPackage: { projectId } } });
  await tx.workPackageItem.deleteMany({ where: { workPackage: { projectId } } });
  await tx.physicalProcess.deleteMany({ where: { workItem: { projectId } } });
  await tx.spk.deleteMany({ where: { workItem: { projectId } } });
  await tx.tenderAttempt.deleteMany({ where: { workItem: { projectId } } });
  await tx.scheduleBaseline.deleteMany({
    where: {
      OR: [
        { workPackage: { projectId } },
        { physicalProcess: { workItem: { projectId } } },
        { tenderAttempt: { workItem: { projectId } } },
      ],
    },
  });

  // Anak langsung proyek
  await tx.workPackage.deleteMany({ where: { projectId } });
  await tx.workItem.deleteMany({ where: { projectId } });
  await tx.afceAttempt.deleteMany({ where: { projectId } });
  await tx.arSupplement.deleteMany({ where: { projectId } });
  await tx.bastDocument.deleteMany({ where: { projectId } });
  await tx.survey.deleteMany({ where: { projectId } });
  await tx.projectEstate.deleteMany({ where: { projectId } });
}

export async function deleteR2Files(fileKeys: readonly string[]) {
  for (const key of fileKeys) {
    await removeObject(key);
  }
}
