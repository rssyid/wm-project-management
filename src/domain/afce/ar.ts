import { matchTier, noMatchingTierError } from "@/domain/approval-matrix/tier";
import { replaceLevels, syncLevelsFromTier } from "@/domain/afce/levels";
import { writeAudit } from "@/domain/audit/service";
import { requireMutableProject } from "@/domain/project-transition/service";
import { decimal } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { parseBusinessDate } from "@/shared/date";
import { DomainError } from "@/shared/errors";
import type {
  CreateArSupplementInput,
  UpdateArSupplementInput,
} from "@/shared/schemas/afce";

async function tierLevelsOf(tx: Tx, tierId: string) {
  return tx.approvalMatrixTierLevel.findMany({
    where: { tierId },
    select: {
      levelNo: true,
      positionId: true,
      position: { select: { name: true } },
    },
  });
}

/** Tier AR memakai nominal tambahan, bukan nilai AFCE (D-08). */
async function tierForAr(amount: ReturnType<typeof decimal>) {
  const tiers = await prisma.approvalMatrixTier.findMany({
    where: { isActive: true, forArSupplement: true },
    select: {
      id: true,
      name: true,
      forAfce: true,
      forArSupplement: true,
      minAmount: true,
      maxAmount: true,
      isActive: true,
    },
  });
  return matchTier(tiers, "AR", amount);
}

function versionConflict() {
  return new DomainError(
    "VERSION_CONFLICT",
    "Data sudah diubah orang lain. Muat ulang halaman lalu ulangi.",
  );
}

/** AC-25: AR tambahan boleh di semua status kecuali COMPLETED dan CANCELLED (dicegah requireMutableProject). */
export async function createArSupplement(
  projectId: string,
  input: CreateArSupplementInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    await requireMutableProject(tx, projectId);
    const amount = decimal(input.amount);
    const tier = await tierForAr(amount);
    if (!tier) throw noMatchingTierError("AR", amount);

    const created = await tx.arSupplement.create({
      data: {
        projectId,
        number: input.number ?? null,
        amount,
        reason: input.reason,
        date: parseBusinessDate(input.date),
        matrixTierId: tier.id,
      },
      select: { id: true },
    });
    await syncLevelsFromTier(
      tx,
      { arSupplementId: created.id },
      null,
      await tierLevelsOf(tx, tier.id),
    );

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "ArSupplement",
      entityId: created.id,
      action: "CREATE",
      after: {
        amount: amount.toFixed(2),
        reason: input.reason,
        date: input.date,
      },
    });
    return { id: created.id };
  });
}

export async function updateArSupplement(
  id: string,
  input: UpdateArSupplementInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const before = await tx.arSupplement.findUnique({
      where: { id },
      select: {
        projectId: true,
        status: true,
        amount: true,
        matrixTierId: true,
        version: true,
      },
    });
    if (!before)
      throw new DomainError("NOT_FOUND", "AR tambahan tidak ditemukan.");
    if (before.status !== "DRAFT") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "AR tambahan sudah diajukan sehingga isinya terkunci.",
      );
    }

    const amount = decimal(input.amount);
    const tier = await tierForAr(amount);
    if (!tier) throw noMatchingTierError("AR", amount);

    const updated = await tx.arSupplement.updateMany({
      where: { id, version: input.version },
      data: {
        number: input.number ?? null,
        amount,
        reason: input.reason,
        date: parseBusinessDate(input.date),
        ...(tier.id !== before.matrixTierId ? { matrixTierId: tier.id } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    if (tier.id !== before.matrixTierId) {
      await syncLevelsFromTier(
        tx,
        { arSupplementId: id },
        before.matrixTierId,
        await tierLevelsOf(tx, tier.id),
      );
    }

    await writeAudit(tx, {
      actorId,
      projectId: before.projectId,
      entityType: "ArSupplement",
      entityId: id,
      action: "UPDATE",
      before: { amount: before.amount.toFixed(2) },
      after: { amount: amount.toFixed(2), reason: input.reason },
    });
    return { id };
  });
}

export async function setArLevels(
  id: string,
  positionIds: readonly string[],
  version: number,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const supplement = await tx.arSupplement.findUnique({
      where: { id },
      select: { projectId: true, status: true },
    });
    if (!supplement) {
      throw new DomainError("NOT_FOUND", "AR tambahan tidak ditemukan.");
    }
    if (supplement.status !== "DRAFT") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "AR tambahan sudah diajukan sehingga levelnya terkunci.",
      );
    }
    const updated = await tx.arSupplement.updateMany({
      where: { id, version },
      data: { version: { increment: 1 } },
    });
    if (updated.count === 0) throw versionConflict();

    await replaceLevels(
      tx,
      { arSupplementId: id },
      positionIds,
      actorId,
      supplement.projectId,
    );
    return { id };
  });
}

/** Pengajuan AR tidak mengubah status proyek (docs/01 §6). */
export async function submitArSupplement(
  id: string,
  input: { submittedDate: string; approvalEmailDate: string; version: number },
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const supplement = await tx.arSupplement.findUnique({
      where: { id },
      select: { projectId: true, status: true },
    });
    if (!supplement) {
      throw new DomainError("NOT_FOUND", "AR tambahan tidak ditemukan.");
    }
    if (supplement.status !== "DRAFT") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "AR tambahan sudah diajukan.",
      );
    }
    const levelCount = await tx.approvalLevelSnapshot.count({
      where: { arSupplementId: id },
    });
    if (levelCount === 0) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Salin level approval dari matriks sebelum mengajukan AR tambahan.",
      );
    }
    const updated = await tx.arSupplement.updateMany({
      where: { id, version: input.version },
      data: {
        status: "DIAJUKAN",
        submittedDate: parseBusinessDate(input.submittedDate),
        approvalEmailDate: parseBusinessDate(input.approvalEmailDate),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    await writeAudit(tx, {
      actorId,
      projectId: supplement.projectId,
      entityType: "ArSupplement",
      entityId: id,
      action: "UPDATE",
      reason: "Pengajuan AR tambahan",
      before: { status: "DRAFT" },
      after: {
        status: "DIAJUKAN",
        submittedDate: input.submittedDate,
        approvalEmailDate: input.approvalEmailDate,
      },
    });
    return { id };
  });
}
