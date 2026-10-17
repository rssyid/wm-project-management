import { decimal, sumDecimal } from "@/infra/decimal";
import { withTransaction } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import type {
  PutWorkItemWeightsInput,
  WorkItemWeightInput,
} from "@/shared/schemas/procurement";

const HUNDRED = decimal("100.00");

function sumPct(values: readonly ReturnType<typeof decimal>[]) {
  return sumDecimal(values);
}

/** Validasi total bobot semua Pekerjaan aktif = 100,00 (AC-31). */
export function validateProjectWeights(input: PutWorkItemWeightsInput): void {
  const total = sumPct(input.weights.map((w) => decimal(w.projectWeightPct)));
  if (!total.equals(HUNDRED)) {
    throw new DomainError(
      "WEIGHT_MISMATCH",
      `Total bobot Pekerjaan ${total.toFixed(2)}%. Harus tepat 100,00%.`,
    );
  }
}

/** Validasi fisik + material = 100 per Pekerjaan (AC-31). */
export function validateWorkItemWeights(input: WorkItemWeightInput): void {
  const total = decimal(input.physicalWeightPct).plus(
    decimal(input.materialWeightPct),
  );
  if (!total.equals(HUNDRED)) {
    throw new DomainError(
      "WEIGHT_MISMATCH",
      `Bobot fisik dan material berjumlah ${total.toFixed(2)}%. Harus tepat 100,00%.`,
    );
  }
}

/**
 * AC-31: Ubah bobot semua Pekerjaan aktif dalam satu transaksi. Tulis AuditLog.
 * Mengembalikan progres baru per Pekerjaan (digunakan oleh pemanggil di F4).
 */
export async function putWorkItemWeights(
  projectId: string,
  input: PutWorkItemWeightsInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    validateProjectWeights(input);

    const before = await tx.workItem.findMany({
      where: { projectId, cancelledAt: null },
      select: {
        id: true,
        name: true,
        projectWeightPct: true,
        physicalWeightPct: true,
        materialWeightPct: true,
        version: true,
      },
      orderBy: { order: "asc" },
    });

    const weightById = new Map(
      input.weights.map((w) => [w.workItemId, decimal(w.projectWeightPct)]),
    );

    const updates = before.map((item) => {
      const newWeight = weightById.get(item.id);
      if (!newWeight) return null;
      return tx.workItem.updateMany({
        where: { id: item.id, version: item.version },
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

    const after = await tx.workItem.findMany({
      where: { projectId, cancelledAt: null },
      select: {
        id: true,
        name: true,
        projectWeightPct: true,
        physicalWeightPct: true,
        materialWeightPct: true,
        version: true,
      },
      orderBy: { order: "asc" },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        projectId,
        entityType: "WorkItem",
        entityId: projectId,
        action: "UPDATE",
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after)),
        reason: "Ubah bobot Pekerjaan",
      },
    });

    return after.map((item) => ({
      id: item.id,
      name: item.name,
      projectWeightPct: item.projectWeightPct.toString(),
      physicalWeightPct: item.physicalWeightPct.toString(),
      materialWeightPct: item.materialWeightPct.toString(),
    }));
  });
}

/**
 * AC-31: Ubah bobot fisik/material satu Pekerjaan. Total harus 100,00.
 * Tulis AuditLog.
 */
export async function updateWorkItemWeights(
  workItemId: string,
  input: WorkItemWeightInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    validateWorkItemWeights(input);

    const item = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        projectId: true,
        physicalWeightPct: true,
        materialWeightPct: true,
        version: true,
        cancelledAt: true,
      },
    });
    if (!item || item.cancelledAt) {
      throw new DomainError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
    }

    const before = {
      physicalWeightPct: item.physicalWeightPct.toString(),
      materialWeightPct: item.materialWeightPct.toString(),
    };
    const after = {
      physicalWeightPct: input.physicalWeightPct,
      materialWeightPct: input.materialWeightPct,
    };

    const updated = await tx.workItem.updateMany({
      where: { id: workItemId, version: item.version },
      data: {
        physicalWeightPct: decimal(input.physicalWeightPct),
        materialWeightPct: decimal(input.materialWeightPct),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Pekerjaan sudah diubah orang lain. Muat ulang lalu ulangi.",
      );
    }

    await tx.auditLog.create({
      data: {
        actorId,
        projectId: item.projectId,
        entityType: "WorkItem",
        entityId: workItemId,
        action: "UPDATE",
        before,
        after,
        reason: "Ubah bobot fisik/material Pekerjaan",
      },
    });

    return { id: workItemId, ...after };
  });
}
