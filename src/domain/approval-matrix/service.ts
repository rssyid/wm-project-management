import { versionConflict, writeAudit } from "@/domain/audit/service";
import {
  assertNoOverlapOrGap,
  matchTier,
  noMatchingTierError,
  type TierDoc,
  type TierForMatch,
} from "@/domain/approval-matrix/tier";
import { Prisma } from "@/generated/prisma/client";
import { decimal, decimalToString } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import type { Tx } from "@/infra/tx";
import { withTransaction } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import type {
  CreateApprovalTierInput,
  UpdateApprovalTierInput,
} from "@/shared/schemas/approval";

const tierSelect = {
  id: true,
  name: true,
  forAfce: true,
  forArSupplement: true,
  minAmount: true,
  maxAmount: true,
  isActive: true,
  version: true,
  levels: {
    select: {
      id: true,
      levelNo: true,
      position: { select: { id: true, code: true, name: true } },
    },
    orderBy: { levelNo: "asc" },
  },
} as const;

type TierRow = {
  id: string;
  name: string;
  forAfce: boolean;
  forArSupplement: boolean;
  minAmount: Prisma.Decimal;
  maxAmount: Prisma.Decimal | null;
  isActive: boolean;
  version: number;
  levels: {
    id: string;
    levelNo: number;
    position: { id: string; code: string; name: string };
  }[];
};

function toTier(row: TierRow) {
  return {
    id: row.id,
    name: row.name,
    forAfce: row.forAfce,
    forArSupplement: row.forArSupplement,
    minAmount: decimalToString(row.minAmount),
    maxAmount: decimalToString(row.maxAmount),
    isActive: row.isActive,
    version: row.version,
    levels: row.levels.map((level) => ({
      id: level.id,
      levelNo: level.levelNo,
      position: level.position,
    })),
  };
}

async function allTiers(excludeId?: string): Promise<TierForMatch[]> {
  return prisma.approvalMatrixTier.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
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
}

export async function listTiers() {
  const rows = await prisma.approvalMatrixTier.findMany({
    select: tierSelect,
    orderBy: { minAmount: "asc" },
  });
  return rows.map(toTier);
}

export async function getTier(id: string) {
  const row = await prisma.approvalMatrixTier.findUnique({
    where: { id },
    select: tierSelect,
  });
  return row ? toTier(row) : null;
}

async function tierFromTx(tx: Tx, id: string) {
  const row = await tx.approvalMatrixTier.findUnique({
    where: { id },
    select: tierSelect,
  });
  if (!row) throw new DomainError("NOT_FOUND", "Tier tidak ditemukan.");
  return toTier(row);
}

function assertRanges(
  others: readonly TierForMatch[],
  candidate: TierForMatch,
  forAfce: boolean,
  forArSupplement: boolean,
): void {
  const withCandidate = [...others, candidate];
  if (forAfce) assertNoOverlapOrGap(withCandidate, "AFCE");
  if (forArSupplement) assertNoOverlapOrGap(withCandidate, "AR");
}

/** AC-03: matriks approval hanya Super Admin; rentang aktif tidak tumpang tindih/berlubang. */
export async function createTier(
  input: CreateApprovalTierInput,
  actorId: string,
) {
  const candidate: TierForMatch = {
    id: "baru",
    name: input.name,
    forAfce: input.forAfce,
    forArSupplement: input.forArSupplement,
    minAmount: decimal(input.minAmount),
    maxAmount: input.maxAmount ? decimal(input.maxAmount) : null,
    isActive: true,
  };
  assertRanges(
    await allTiers(),
    candidate,
    input.forAfce,
    input.forArSupplement,
  );

  return withTransaction(async (tx) => {
    const created = await tx.approvalMatrixTier.create({
      data: {
        name: input.name,
        forAfce: input.forAfce,
        forArSupplement: input.forArSupplement,
        minAmount: candidate.minAmount,
        maxAmount: candidate.maxAmount,
        levels: {
          create: input.positionIds.map((positionId, index) => ({
            levelNo: index + 1,
            positionId,
          })),
        },
      },
      select: { id: true },
    });
    await writeAudit(tx, {
      actorId,
      entityType: "ApprovalMatrixTier",
      entityId: created.id,
      action: "CREATE",
      after: { name: input.name, positionIds: input.positionIds },
    });
    return tierFromTx(tx, created.id);
  });
}

/** Perubahan tier tidak mengubah snapshot level dokumen yang sudah ada (docs/01 §6). */
export async function updateTier(
  id: string,
  input: UpdateApprovalTierInput,
  actorId: string,
) {
  const before = await prisma.approvalMatrixTier.findUnique({
    where: { id },
    select: tierSelect,
  });
  if (!before) throw new DomainError("NOT_FOUND", "Tier tidak ditemukan.");

  const isActive = input.isActive ?? before.isActive;
  const candidate: TierForMatch = {
    id,
    name: input.name,
    forAfce: input.forAfce,
    forArSupplement: input.forArSupplement,
    minAmount: decimal(input.minAmount),
    maxAmount: input.maxAmount ? decimal(input.maxAmount) : null,
    isActive,
  };
  if (isActive) {
    assertRanges(
      await allTiers(id),
      candidate,
      input.forAfce,
      input.forArSupplement,
    );
  }

  return withTransaction(async (tx) => {
    const updated = await tx.approvalMatrixTier.updateMany({
      where: { id, version: input.version },
      data: {
        name: input.name,
        forAfce: input.forAfce,
        forArSupplement: input.forArSupplement,
        minAmount: candidate.minAmount,
        maxAmount: candidate.maxAmount,
        isActive,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    await tx.approvalMatrixTierLevel.deleteMany({ where: { tierId: id } });
    await tx.approvalMatrixTierLevel.createMany({
      data: input.positionIds.map((positionId, index) => ({
        tierId: id,
        levelNo: index + 1,
        positionId,
      })),
    });

    await writeAudit(tx, {
      actorId,
      entityType: "ApprovalMatrixTier",
      entityId: id,
      action: isActive ? "UPDATE" : "DEACTIVATE",
      before: toTier(before),
      after: { name: input.name, positionIds: input.positionIds, isActive },
    });
    return tierFromTx(tx, id);
  });
}

/** docs/04 §2: pencocokan untuk pratinjau di form; 409 bila tidak ada tier yang cocok. */
export async function matchTierForAmount(doc: TierDoc, amount: string) {
  const value = decimal(amount);
  const tier = matchTier(await allTiers(), doc, value);
  if (!tier) throw noMatchingTierError(doc, value);
  return getTier(tier.id);
}
