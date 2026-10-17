import { decimal } from "@/infra/decimal";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { assertUpdated, writeAudit } from "@/domain/audit/service";
import {
  requireMutableProject,
  assertFieldInputAllowed,
  autoTransitionProject,
} from "@/domain/project-transition/service";
import { DomainError } from "@/shared/errors";
import type {
  CreateDeliveryInput,
  CreateDeliveryCorrectionInput,
  UpdatePaymentInput,
} from "@/shared/schemas/procurement";

const deliveryAuditSelect = {
  id: true,
  deliveryDate: true,
  doNumber: true,
  notes: true,
  isCorrection: true,
  correctionReason: true,
  recordedAt: true,
} as const;

/** AC-41: PO wajib sebelum kiriman. qty positif per item. */
async function assertPoExists(tx: Tx, workPackageId: string): Promise<void> {
  const po = await tx.purchaseOrder.findUnique({
    where: { workPackageId },
    select: { id: true },
  });
  if (!po) {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "PO harus dicatat sebelum catat kiriman.",
    );
  }
}

/** Hitung total terima per item sampai sekarang (termasuk koreksi). */
async function receivedQtyPerItem(
  tx: Tx,
  workPackageId: string,
): Promise<Map<string, ReturnType<typeof decimal>>> {
  const items = await tx.packageDeliveryItem.findMany({
    where: { delivery: { workPackageId } },
    select: {
      workPackageItemId: true,
      qty: true,
      delivery: { select: { isCorrection: true } },
    },
  });
  const map = new Map<string, ReturnType<typeof decimal>>();
  for (const row of items) {
    const current = map.get(row.workPackageItemId) ?? decimal("0");
    const adjusted = row.delivery.isCorrection
      ? current.minus(row.qty)
      : current.plus(row.qty);
    map.set(row.workPackageItemId, adjusted);
  }
  return map;
}

/** AC-41, AC-42: Catat kiriman. PO wajib; kiriman pertama → EXECUTION tepat sekali. */
export async function createDelivery(
  workPackageId: string,
  input: CreateDeliveryInput,
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
        cancelledDate: true,
        purchaseOrder: { select: { id: true } },
        project: { select: { id: true, status: true } },
        workItem: { select: { projectId: true } },
      },
    });
    if (!wp || wp.cancelledDate) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }

    const project = await requireMutableProject(tx, wp.projectId);
    assertFieldInputAllowed(project);
    await assertPoExists(tx, workPackageId);

    if (
      wp.status === "COMPLETED" ||
      wp.status === "CANCELLED" ||
      wp.status === "DRAFT"
    ) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Kiriman tidak bisa dicatat pada Paket Kerja dengan status "${wp.status}".`,
      );
    }

    const itemsInput = input.items;
    const itemIds = itemsInput.map((i) => i.workPackageItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Item kiriman tidak boleh duplikat.",
      );
    }

    const packageItems = await tx.workPackageItem.findMany({
      where: { workPackageId },
      select: { id: true, plannedQty: true },
    });
    const plannedById = new Map(packageItems.map((i) => [i.id, i.plannedQty]));
    for (const item of itemsInput) {
      if (!plannedById.has(item.workPackageItemId)) {
        throw new DomainError(
          "NOT_FOUND",
          `Item ${item.workPackageItemId} tidak ada dalam Paket Kerja ini.`,
        );
      }
      if (decimal(item.qty).lessThanOrEqualTo(0)) {
        throw new DomainError(
          "VALIDATION_ERROR",
          "Qty kiriman harus lebih besar dari nol.",
        );
      }
    }

    const delivery = await tx.packageDelivery.create({
      data: {
        workPackageId,
        deliveryDate: new Date(input.deliveryDate),
        doNumber: input.doNumber ?? null,
        notes: input.notes ?? null,
        isCorrection: false,
        recordedById: actorId,
        items: {
          create: itemsInput.map((item) => ({
            workPackageItemId: item.workPackageItemId,
            qty: decimal(item.qty),
          })),
        },
      },
      select: deliveryAuditSelect,
    });

    // Hitung status baru paket setelah kiriman ini.
    const allReceived = await receivedQtyPerItem(tx, workPackageId);
    let newStatus = wp.status;
    let allFulfilled = true;
    for (const item of packageItems) {
      const got = allReceived.get(item.id) ?? decimal("0");
      if (got.lessThan(item.plannedQty)) {
        allFulfilled = false;
        break;
      }
    }
    if (allFulfilled) {
      newStatus = "DELIVERED";
    } else if (wp.status === "PO_ISSUED") {
      newStatus = "PARTIALLY_DELIVERED";
    }

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data: { status: newStatus, version: { increment: 1 } },
    });
    assertUpdated(updated.count);

    // AC-42: Kiriman pertama di proyek → EXECUTION tepat sekali.
    let executionTriggered = false;
    if (newStatus !== wp.status) {
      const deliveryCount = await tx.packageDelivery.count({
        where: {
          workPackage: { projectId: wp.projectId },
          isCorrection: false,
        },
      });
      if (deliveryCount === 1) {
        executionTriggered = await autoTransitionProject(tx, {
          projectId: wp.projectId,
          from: "PROCUREMENT",
          to: "EXECUTION",
          actorId,
        });
      }
    }

    // Jika semua terpenuhi → COMPLETED otomatis (AC-43).
    if (allFulfilled) {
      await tx.workPackage.updateMany({
        where: { id: workPackageId },
        data: { status: "COMPLETED", completedDate: new Date() },
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "PackageDelivery",
      entityId: delivery.id,
      action: "CREATE",
      after: { ...delivery },
    });

    return {
      ...delivery,
      workPackageId,
      newStatus,
      executionTriggered,
    };
  });
}

/** AC-43: Koreksi kiriman: qty negatif + alasan; total per item ≥ 0; ditolak saat WAITING_BAST. */
export async function createDeliveryCorrection(
  workPackageId: string,
  input: CreateDeliveryCorrectionInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        projectId: true,
        status: true,
        version: true,
        cancelledDate: true,
        project: { select: { id: true, status: true } },
        items: {
          select: {
            id: true,
            plannedQty: true,
            deliveryItems: {
              select: {
                delivery: { select: { isCorrection: true } },
              },
            },
          },
        },
      },
    });
    if (!wp || wp.cancelledDate) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }

    const project = await requireMutableProject(tx, wp.projectId);
    assertFieldInputAllowed(project);

    if (wp.status === "COMPLETED" || wp.status === "CANCELLED") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Koreksi tidak bisa dicatat pada Paket Kerja yang selesai atau dibatalkan.",
      );
    }

    const itemIds = input.items.map((i) => i.workPackageItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Item koreksi tidak boleh duplikat.",
      );
    }

    const packageItems = await tx.workPackageItem.findMany({
      where: { workPackageId },
      select: {
        id: true,
        plannedQty: true,
        deliveryItems: {
          select: {
            id: true,
            delivery: { select: { isCorrection: true } },
          },
        },
      },
    });
    const byId = new Map(packageItems.map((i) => [i.id, i]));
    for (const item of input.items) {
      const planned = byId.get(item.workPackageItemId);
      if (!planned) {
        throw new DomainError(
          "NOT_FOUND",
          `Item ${item.workPackageItemId} tidak ada dalam Paket Kerja ini.`,
        );
      }
      if (decimal(item.qty).greaterThanOrEqualTo(0)) {
        throw new DomainError(
          "VALIDATION_ERROR",
          "Qty koreksi harus negatif (pengurangan).",
        );
      }
    }

    const correction = await tx.packageDelivery.create({
      data: {
        workPackageId,
        deliveryDate: new Date(input.deliveryDate),
        doNumber: null,
        notes: null,
        isCorrection: true,
        correctionReason: input.correctionReason,
        recordedById: actorId,
        items: {
          create: input.items.map((item) => ({
            workPackageItemId: item.workPackageItemId,
            qty: decimal(item.qty),
          })),
        },
      },
      select: deliveryAuditSelect,
    });

    // Hitung total terima per item setelah koreksi.
    const received = await receivedQtyPerItem(tx, workPackageId);
    let newStatus = wp.status;
    let belowPlan = false;
    for (const item of packageItems) {
      const got = received.get(item.id) ?? decimal("0");
      if (got.lessThan(0)) {
        throw new DomainError(
          "VALIDATION_ERROR",
          `Total terima item ${item.id} tidak boleh kurang dari nol.`,
        );
      }
      if (got.lessThan(item.plannedQty)) {
        belowPlan = true;
      }
    }
    if (belowPlan) {
      newStatus = "PARTIALLY_DELIVERED";
    }

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data: { status: newStatus, version: { increment: 1 } },
    });
    assertUpdated(updated.count);

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "PackageDelivery",
      entityId: correction.id,
      action: "CREATE",
      after: {
        id: correction.id,
        deliveryDate: correction.deliveryDate,
        isCorrection: correction.isCorrection,
        correctionReason: correction.correctionReason,
      },
      reason: input.correctionReason,
    });

    return { ...correction, workPackageId, newStatus };
  });
}

/** AC-43: Paket COMPLETED otomatis saat semua item terpenuhi. Dipanggil setelah kiriman. */
export async function autoCompletePackage(
  tx: Tx,
  workPackageId: string,
): Promise<boolean> {
  const wp = await tx.workPackage.findUnique({
    where: { id: workPackageId },
    select: {
      id: true,
      projectId: true,
      status: true,
      items: {
        select: { id: true, plannedQty: true },
        include: {
          deliveryItems: {
            include: { delivery: { select: { isCorrection: true } } },
          },
        },
      },
    },
  });
  if (!wp) return false;

  const received = await receivedQtyPerItem(tx, workPackageId);
  const packageItems = await tx.workPackageItem.findMany({
    where: { workPackageId },
    select: { id: true, plannedQty: true },
  });
  let allFulfilled = true;
  for (const item of packageItems) {
    const got = received.get(item.id) ?? decimal("0");
    if (got.lessThan(item.plannedQty)) {
      allFulfilled = false;
      break;
    }
  }

  if (allFulfilled && wp.status !== "COMPLETED") {
    await tx.workPackage.updateMany({
      where: { id: workPackageId },
      data: { status: "COMPLETED", completedDate: new Date() },
    });
    await writeAudit(tx, {
      actorId: null,
      projectId: wp.projectId,
      entityType: "WorkPackage",
      entityId: workPackageId,
      action: "UPDATE",
      before: { status: wp.status },
      after: { status: "COMPLETED" },
      reason: "Semua item terpenuhi",
    });
    return true;
  }
  return false;
}

/** AC-44: Pembayaran bisa diubah sampai COMPLETED (termasuk WAITING_BAST), diaudit. */
export async function updatePayment(
  workPackageId: string,
  input: UpdatePaymentInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const wp = await tx.workPackage.findUnique({
      where: { id: workPackageId },
      select: {
        id: true,
        projectId: true,
        status: true,
        paymentStatus: true,
        invoiceAmount: true,
        paidDate: true,
        paymentNotes: true,
        version: true,
        project: { select: { id: true, status: true } },
      },
    });
    if (!wp) {
      throw new DomainError("NOT_FOUND", "Paket Kerja tidak ditemukan.");
    }
    if (wp.status === "COMPLETED") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Pembayaran tidak bisa diubah setelah Paket Kerja COMPLETED.",
      );
    }

    const before = {
      paymentStatus: wp.paymentStatus,
      invoiceAmount: wp.invoiceAmount?.toString() ?? null,
      paidDate: wp.paidDate,
      paymentNotes: wp.paymentNotes,
    };
    const after: Record<string, unknown> = {
      paymentStatus: input.paymentStatus,
    };
    const data: Record<string, unknown> = {
      paymentStatus: input.paymentStatus,
      version: { increment: 1 },
    };
    if (input.invoiceAmount !== undefined) {
      data.invoiceAmount =
        input.invoiceAmount === null ? null : decimal(input.invoiceAmount);
      after.invoiceAmount = input.invoiceAmount;
    }
    if (input.paidDate !== undefined) {
      data.paidDate = input.paidDate ? new Date(input.paidDate) : null;
      after.paidDate = input.paidDate;
    }
    if (input.paymentNotes !== undefined) {
      data.paymentNotes = input.paymentNotes;
      after.paymentNotes = input.paymentNotes;
    }

    const updated = await tx.workPackage.updateMany({
      where: { id: workPackageId, version: wp.version },
      data,
    });
    assertUpdated(updated.count);

    await writeAudit(tx, {
      actorId,
      projectId: wp.projectId,
      entityType: "WorkPackage",
      entityId: workPackageId,
      action: "UPDATE",
      before,
      after,
      reason: "Ubah pembayaran",
    });

    return {
      id: workPackageId,
      ...after,
    };
  });
}
