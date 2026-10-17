import { decimal, sumDecimal } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { assertUpdated, writeAudit } from "@/domain/audit/service";
import {
  requireMutableProject,
  autoTransitionProject,
} from "@/domain/project-transition/service";
import { DomainError } from "@/shared/errors";
import type {
  CreateWorkPackageInput,
  UpdateWorkPackageInput,
  CancelWorkPackageInput,
  CreatePurchaseRequestInput,
  CreatePurchaseOrderInput,
  StartProductionInput,
} from "@/shared/schemas/procurement";

const workPackageAuditSelect = {
  id: true,
  name: true,
  status: true,
  weightPct: true,
  vendorId: true,
  productionStartDate: true,
  completedDate: true,
  cancelledDate: true,
  cancelReason: true,
  version: true,
} as const;

/** AC-31: Bobot paket aktif per Pekerjaan = bobot material Pekerjaan. */
async function assertPackageWeights(
  tx: Tx,
  workItemId: string,
  packageId: string | null,
  newWeight: ReturnType<typeof decimal>,
): Promise<void> {
  const workItem = await tx.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      materialWeightPct: true,
      workPackages: {
        select: { id: true, weightPct: true },
        where: { cancelledDate: null },
      },
    },
  });
  if (!workItem) {
    throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
  }

  const existing = packageId
    ? workItem.workPackages.filter((p) => p.id !== packageId)
    : workItem.workPackages;
  const total = decimal(
    sumDecimal([...existing.map((p) => p.weightPct), newWeight]).toString(),
  );
  if (!total.equals(workItem.materialWeightPct)) {
    throw new DomainError(
      "WEIGHT_MISMATCH",
      `Total bobot paket ${total.toFixed(2)}%. Harus sama dengan bobot material Pekerjaan ${workItem.materialWeightPct.toFixed(2)}%.`,
    );
  }
}

/** Buat Paket Kerja: item + bobot paket aktif = bobot material Pekerjaan (AC-31). */
export async function createWorkPackage(
  workItemId: string,
  input: CreateWorkPackageInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        projectId: true,
        project: { select: { id: true, status: true } },
        materialWeightPct: true,
        workPackages: {
          select: { id: true, weightPct: true },
          where: { cancelledDate: null },
        },
      },
    });
    if (!workItem) {
      throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
    }

    await requireMutableProject(tx, workItem.projectId);

    const newWeight = decimal(input.weightPct);
    await assertPackageWeights(tx, workItemId, null, newWeight);

    const created = await tx.workPackage.create({
      data: {
        workItemId,
        projectId: workItem.projectId,
        name: input.name,
        weightPct: newWeight,
        vendorId: input.vendorId ?? null,
        status: "DRAFT",
      },
      select: workPackageAuditSelect,
    });

    // Buat item paket dengan urutan.
    await Promise.all(
      input.items.map((item, index) =>
        tx.workPackageItem.create({
          data: {
            workPackageId: created.id,
            materialId: item.materialId,
            unitId: item.unitId,
            plannedQty: decimal(item.plannedQty),
            order: index + 1,
          },
        }),
      ),
    );

    await writeAudit(tx, {
      actorId,
      projectId: workItem.projectId,
      entityType: "WorkPackage",
      entityId: created.id,
      action: "CREATE",
      after: { ...created, weightPct: created.weightPct.toString() },
    });

    return created;
  });
}

/** Ubah Paket Kerja: item hanya sebelum kiriman pertama. */
export async function updateWorkPackage(
  workPackageId: string,
  input: UpdateWorkPackageInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        workItemId: true,
        projectId: true,
        status: true,
        weightPct: true,
        version: true,
        workItem: { select: { projectId: true } },
        deliveries: {
          select: { id: true },
          where: { isCorrection: false },
        },
      },
    });
    if (!wp) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }

    await requireMutableProject(tx, wp.projectId);

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (input.name !== undefined) data.name = input.name;
    if (input.weightPct !== undefined) {
      await assertPackageWeights(
        tx,
        wp.workItemId,
        workPackageId,
        decimal(input.weightPct),
      );
      data.weightPct = decimal(input.weightPct);
    }
    if (input.vendorId !== undefined) data.vendorId = input.vendorId;

    // Item hanya sebelum kiriman pertama (docs/01 §9).
    if (input.items !== undefined) {
      if (wp.deliveries.length > 0) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Item Paket Kerja tidak bisa diubah setelah kiriman pertama.",
        );
      }
      await tx.workPackageItem.deleteMany({ where: { workPackageId } });
      await Promise.all(
        input.items.map((item, index) =>
          tx.workPackageItem.create({
            data: {
              workPackageId,
              materialId: item.materialId,
              unitId: item.unitId,
              plannedQty: decimal(item.plannedQty),
              order: index + 1,
            },
          }),
        ),
      );
    }

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data,
    });
    assertUpdated(updated.count);

    const after = await tx.workPackage.findUniqueOrThrow({
      where: { id: workPackageId },
      select: workPackageAuditSelect,
    });

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "WorkPackage",
      entityId: workPackageId,
      action: "UPDATE",
      before: {
        ...wp,
        weightPct: wp.weightPct.toString(),
      },
      after: {
        ...after,
        weightPct: after.weightPct.toString(),
      },
    });

    return after;
  });
}

/** AC-40: PR → PR_SUBMITTED, baseline paket dikunci, PR pertama → PROCUREMENT. */
export async function createPurchaseRequest(
  workPackageId: string,
  input: CreatePurchaseRequestInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        workItemId: true,
        projectId: true,
        status: true,
        version: true,
        purchaseRequest: { select: { id: true } },
        project: { select: { id: true, status: true } },
      },
    });
    if (!wp) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }
    if (wp.purchaseRequest) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "PR sudah terbit untuk Paket Kerja ini.",
      );
    }
    if (wp.status === "COMPLETED" || wp.status === "CANCELLED") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Tidak bisa terbit PR pada Paket Kerja yang selesai atau dibatalkan.",
      );
    }

    await requireMutableProject(tx, wp.projectId);

    const pr = await tx.purchaseRequest.create({
      data: {
        workPackageId,
        number: input.number,
        date: new Date(input.date),
        createdById: actorId,
      },
      select: { id: true, number: true, date: true, createdAt: true },
    });

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data: { status: "PR_SUBMITTED", version: { increment: 1 } },
    });
    assertUpdated(updated.count);

    // PR pertama di proyek → PROCUREMENT (AC-40).
    const prCount = await tx.purchaseRequest.count({
      where: { workPackage: { projectId: wp.projectId } },
    });
    if (prCount === 1) {
      await autoTransitionProject(tx, {
        projectId: wp.projectId,
        from: "AFCE_AR_APPROVED",
        to: "PROCUREMENT",
        actorId,
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "PurchaseRequest",
      entityId: pr.id,
      action: "CREATE",
      after: pr,
    });

    return { ...pr, workPackageId };
  });
}

/** Catat PO: → PO_ISSUED. */
export async function createPurchaseOrder(
  workPackageId: string,
  input: CreatePurchaseOrderInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        workItemId: true,
        projectId: true,
        status: true,
        version: true,
        purchaseOrder: { select: { id: true } },
        purchaseRequest: { select: { id: true } },
        project: { select: { id: true } },
      },
    });
    if (!wp) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }
    if (wp.purchaseOrder) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "PO sudah dicatat untuk Paket Kerja ini.",
      );
    }
    if (!wp.purchaseRequest) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "PR harus terlebih dahulu sebelum PO.",
      );
    }
    if (wp.status === "COMPLETED" || wp.status === "CANCELLED") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Tidak bisa mencatat PO pada Paket Kerja yang selesai atau dibatalkan.",
      );
    }

    const po = await tx.purchaseOrder.create({
      data: {
        workPackageId,
        number: input.number,
        date: new Date(input.date),
        vendorId: input.vendorId,
        createdById: actorId,
      },
      select: { id: true, number: true, date: true, createdAt: true },
    });

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data: { status: "PO_ISSUED", version: { increment: 1 } },
    });
    assertUpdated(updated.count);

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: "CREATE",
      after: po,
    });

    return { ...po, workPackageId };
  });
}

/** Mulai produksi (opsional): → PRODUKSI. */
export async function startProduction(
  workPackageId: string,
  input: StartProductionInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        projectId: true,
        status: true,
        productionStartDate: true,
        version: true,
        project: { select: { id: true } },
      },
    });
    if (!wp) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }
    if (wp.status !== "PO_ISSUED" && wp.status !== "PRODUKSI") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Produksi hanya bisa dimulai setelah PO diterbitkan.",
      );
    }

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data: {
        status: "PRODUKSI",
        productionStartDate: new Date(input.productionStartDate),
        version: { increment: 1 },
      },
    });
    assertUpdated(updated.count);

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "WorkPackage",
      entityId: workPackageId,
      action: "UPDATE",
      before: {
        status: wp.status,
        productionStartDate: wp.productionStartDate,
      },
      after: {
        status: "PRODUKSI",
        productionStartDate: new Date(input.productionStartDate),
      },
    });

    return { id: workPackageId, status: "PRODUKSI" };
  });
}

/** GET work package dengan items untuk detail. */
export async function getWorkPackage(workPackageId: string) {
  return prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: {
      id: true,
      name: true,
      status: true,
      weightPct: true,
      version: true,
      items: {
        select: { id: true, materialId: true, unitId: true, plannedQty: true },
        orderBy: { order: "asc" },
      },
    },
  });
}

/** AC-32: Batal Paket Kerja sebelum kiriman pertama; alasan + bobot pengganti. */
export async function cancelWorkPackage(
  workPackageId: string,
  input: CancelWorkPackageInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        workItemId: true,
        projectId: true,
        status: true,
        weightPct: true,
        version: true,
        cancelledDate: true,
        deliveries: { select: { id: true }, where: { isCorrection: false } },
        workItem: { select: { projectId: true, materialWeightPct: true } },
      },
    });
    if (!wp || wp.cancelledDate) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }
    if (wp.deliveries.length > 0) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Paket Kerja tidak bisa dibatalkan setelah kiriman pertama.",
      );
    }

    await requireMutableProject(tx, wp.projectId);

    const beforeWeights = await tx.workPackage.findMany({
      where: { workItemId: wp.workItemId, cancelledDate: null },
      select: { id: true, weightPct: true, version: true },
    });

    const weightById = new Map(
      input.weights.map((w) => [w.workPackageId, decimal(w.weightPct)]),
    );

    const remaining = beforeWeights.filter((w) => w.id !== workPackageId);
    const total = decimal(
      sumDecimal([
        ...remaining.map((w) => w.weightPct),
        ...input.weights.map((w) => decimal(w.weightPct)),
      ]).toString(),
    );
    if (!total.equals(wp.workItem.materialWeightPct)) {
      throw new DomainError(
        "WEIGHT_MISMATCH",
        `Total bobot paket setelah pembatalan ${total.toFixed(2)}%. Harus sama dengan bobot material Pekerjaan ${wp.workItem.materialWeightPct.toFixed(2)}%.`,
      );
    }

    const updates = remaining.map((w) => {
      const newWeight = weightById.get(w.id);
      if (!newWeight) return null;
      return tx.workPackage.updateMany({
        where: { id: w.id, version: w.version },
        data: { weightPct: newWeight, version: { increment: 1 } },
      });
    });
    const results = await Promise.all(updates.filter(Boolean));
    if (results.some((r) => r === null || r.count === 0)) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Salah satu Pekerjaan sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    const cancelled = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data: {
        status: "CANCELLED",
        cancelledDate: new Date(),
        cancelReason: input.reason,
        version: { increment: 1 },
      },
    });
    assertUpdated(cancelled.count);

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "WorkPackage",
      entityId: workPackageId,
      action: "DELETE",
      before: {
        ...wp,
        weightPct: wp.weightPct.toString(),
      },
      after: {
        id: workPackageId,
        cancelledDate: new Date(),
        cancelReason: input.reason,
      },
      reason: input.reason,
    });

    return { id: workPackageId };
  });
}
