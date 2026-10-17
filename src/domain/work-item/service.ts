import { decimal, sumDecimal } from "@/infra/decimal";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { assertUpdated, writeAudit } from "@/domain/audit/service";
import { requireMutableProject } from "@/domain/project-transition/service";
import { DomainError } from "@/shared/errors";
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  CancelWithWeightsInput,
} from "@/shared/schemas/procurement";
import { PROJECT_STATUS_LABEL } from "@/shared/project-status";

const workItemAuditSelect = {
  id: true,
  projectId: true,
  name: true,
  type: true,
  projectWeightPct: true,
  physicalWeightPct: true,
  materialWeightPct: true,
  targetVolume: true,
  unitId: true,
  order: true,
  version: true,
  cancelledAt: true,
} as const;

/** AC-30: Pekerjaan & Paket Kerja hanya boleh dibuat setelah AFCE Approved. */
async function requireAfceApproved(tx: Tx, projectId: string): Promise<void> {
  const project = await requireMutableProject(tx, projectId);
  if (project.status !== "AFCE_AR_APPROVED") {
    throw new DomainError(
      "PRECONDITION_FAILED",
      `Pekerjaan hanya bisa dibuat setelah status proyek "${PROJECT_STATUS_LABEL.AFCE_AR_APPROVED}". Sekarang "${PROJECT_STATUS_LABEL[project.status]}".`,
    );
  }
}

/** AC-30: Buat Pekerjaan baru. Bobot semua aktif = 100,00; buat PhysicalProcess untuk TENDER/SWAKELOLA. */
export async function createWorkItem(
  projectId: string,
  input: CreateWorkItemInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    await requireAfceApproved(tx, projectId);

    const beforeWeights = await tx.workItem.findMany({
      where: { projectId, cancelledAt: null },
      select: { id: true, projectWeightPct: true },
    });

    const existingTotal = sumDecimal(
      beforeWeights.map((w) => w.projectWeightPct),
    );
    const newTotal = existingTotal.plus(decimal(input.projectWeightPct));
    if (!newTotal.equals(decimal("100.00"))) {
      throw new DomainError(
        "WEIGHT_MISMATCH",
        `Total bobot akan menjadi ${newTotal.toFixed(2)}%. Harus tepat 100,00%.`,
      );
    }

    const lastOrder = await tx.workItem.aggregate({
      where: { projectId, cancelledAt: null },
      _max: { order: true },
    });
    const nextOrder = (lastOrder._max?.order ?? 0) + 1;

    const created = await tx.workItem.create({
      data: {
        projectId,
        name: input.name,
        type: input.type,
        projectWeightPct: decimal(input.projectWeightPct),
        physicalWeightPct: decimal(input.physicalWeightPct),
        materialWeightPct: decimal(input.materialWeightPct),
        targetVolume:
          input.targetVolume !== undefined && input.targetVolume !== null
            ? decimal(input.targetVolume)
            : null,
        unitId: input.unitId ?? null,
        order: nextOrder,
      },
      select: {
        id: true,
        name: true,
        type: true,
        projectWeightPct: true,
        physicalWeightPct: true,
        materialWeightPct: true,
        targetVolume: true,
        unitId: true,
        order: true,
        version: true,
      },
    });

    // Fisik dibuat otomatis untuk TENDER/SWAKELOLA (docs/01 §4).
    if (input.type === "TENDER_CONTRACT" || input.type === "SWAKELOLA") {
      await tx.physicalProcess.create({
        data: {
          workItemId: created.id,
          status: "BELUM_MULAI",
        },
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "WorkItem",
      entityId: created.id,
      action: "CREATE",
      after: {
        ...created,
        projectWeightPct: created.projectWeightPct.toString(),
        physicalWeightPct: created.physicalWeightPct.toString(),
        materialWeightPct: created.materialWeightPct.toString(),
      },
    });

    return created;
  });
}

/** Ubah Pekerjaan: fisik + material = 100. */
export async function updateWorkItem(
  workItemId: string,
  input: UpdateWorkItemInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const item = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        projectId: true,
        name: true,
        type: true,
        projectWeightPct: true,
        physicalWeightPct: true,
        materialWeightPct: true,
        targetVolume: true,
        unitId: true,
        order: true,
        version: true,
        cancelledAt: true,
      },
    });
    if (!item || item.cancelledAt) {
      throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
    }

    await requireMutableProject(tx, item.projectId);
    // AC-33: tipe Pekerjaan mengunci jalur pengadaan (tender, swakelola, atau pembelian) dan
    // tidak bisa diubah setelah dibuat.
    if (input.type !== undefined && input.type !== item.type) {
      throw new DomainError(
        "TYPE_LOCKED",
        "Tipe Pekerjaan tidak bisa diubah setelah dibuat. Batalkan dan buat Pekerjaan baru bila alur pengadaannya berbeda.",
      );
    }

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (input.name !== undefined) data.name = input.name;
    if (input.projectWeightPct !== undefined)
      data.projectWeightPct = decimal(input.projectWeightPct);
    if (input.physicalWeightPct !== undefined)
      data.physicalWeightPct = decimal(input.physicalWeightPct);
    if (input.materialWeightPct !== undefined)
      data.materialWeightPct = decimal(input.materialWeightPct);
    if (input.targetVolume !== undefined)
      data.targetVolume =
        input.targetVolume === null ? null : decimal(input.targetVolume);
    if (input.unitId !== undefined) data.unitId = input.unitId;

    const updated = await tx.workItem.updateMany({
      where: { id: workItemId, version: item.version },
      data,
    });
    assertUpdated(updated.count);

    const after = await tx.workItem.findUniqueOrThrow({
      where: { id: workItemId },
      select: workItemAuditSelect,
    });

    await writeAudit(tx, {
      actorId,
      projectId: item.projectId,
      entityType: "WorkItem",
      entityId: workItemId,
      action: "UPDATE",
      before: {
        ...item,
        projectWeightPct: item.projectWeightPct.toString(),
        physicalWeightPct: item.physicalWeightPct.toString(),
        materialWeightPct: item.materialWeightPct.toString(),
      },
      after: {
        ...after,
        projectWeightPct: after.projectWeightPct.toString(),
        physicalWeightPct: after.physicalWeightPct.toString(),
        materialWeightPct: after.materialWeightPct.toString(),
      },
    });

    return after;
  });
}

/** AC-32: Batal Pekerjaan wajib bobot pengganti dalam transaksi yang sama. */
export async function cancelWorkItem(
  workItemId: string,
  input: CancelWithWeightsInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const item = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        projectId: true,
        projectWeightPct: true,
        version: true,
        cancelledAt: true,
      },
    });
    if (!item || item.cancelledAt) {
      throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
    }

    const { projectId } = item;
    await requireMutableProject(tx, projectId);

    const beforeWeights = await tx.workItem.findMany({
      where: { projectId, cancelledAt: null },
      select: { id: true, projectWeightPct: true, version: true },
    });

    const weightById = new Map(
      input.weights.map((w) => [w.workItemId, decimal(w.projectWeightPct)]),
    );

    // Bobot pengganti menggantikan semua Pekerjaan aktif yang tersisa; total harus 100,00.
    const remaining = beforeWeights.filter((w) => w.id !== workItemId);
    const missing = remaining.filter((w) => !weightById.has(w.id));
    if (missing.length > 0) {
      throw new DomainError(
        "WEIGHT_MISMATCH",
        `Bobot pengganti harus mencakup semua Pekerjaan aktif yang tersisa: ${missing.map((w) => w.id).join(", ")}.`,
      );
    }

    const total = decimal(
      sumDecimal(
        input.weights.map((w) => decimal(w.projectWeightPct)),
      ).toString(),
    );
    if (!total.equals(decimal("100.00"))) {
      throw new DomainError(
        "WEIGHT_MISMATCH",
        `Total bobot setelah pembatalan ${total.toFixed(2)}%. Harus tepat 100,00%.`,
      );
    }

    const updates = remaining.map((w) => {
      const newWeight = weightById.get(w.id);
      if (!newWeight) return null;
      return tx.workItem.updateMany({
        where: { id: w.id, version: w.version },
        data: { projectWeightPct: newWeight, version: { increment: 1 } },
      });
    });
    const results = await Promise.all(updates.filter(Boolean));
    if (results.some((r) => r === null || r.count === 0)) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Salah satu Pekerjaan sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    const cancelled = await tx.workItem.updateMany({
      where: { id: workItemId, version: item.version },
      data: {
        cancelledAt: new Date(),
        cancelReason: input.reason,
        version: { increment: 1 },
      },
    });
    assertUpdated(cancelled.count);

    await writeAudit(tx, {
      actorId,
      projectId: item.projectId,
      entityType: "WorkItem",
      entityId: workItemId,
      action: "DELETE",
      before: {
        ...item,
        projectWeightPct: item.projectWeightPct.toString(),
      },
      after: {
        id: workItemId,
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
      reason: input.reason,
    });

    return { id: workItemId };
  });
}
