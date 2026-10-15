import { matchTier, noMatchingTierError } from "@/domain/approval-matrix/tier";
import { differsFromMatrix, orderedPositionIds } from "@/domain/afce/levels";
import { Prisma } from "@/generated/prisma/client";
import { decimalToString } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import { businessDateIso } from "@/shared/date";

const attemptSelect = {
  id: true,
  projectId: true,
  attemptNo: true,
  status: true,
  rabReady: true,
  afceNumber: true,
  documentDate: true,
  basisAmount: true,
  matrixTierId: true,
  submittedDate: true,
  approvalEmailDate: true,
  decidedDate: true,
  notes: true,
  version: true,
  matrixTier: {
    select: { id: true, name: true, minAmount: true, maxAmount: true },
  },
  boqItems: {
    select: {
      id: true,
      lineNo: true,
      buildingName: true,
      activityName: true,
      amount: true,
      notes: true,
    },
    orderBy: { lineNo: "asc" },
  },
  levels: {
    select: {
      id: true,
      levelNo: true,
      positionId: true,
      positionNameSnapshot: true,
      record: {
        select: {
          id: true,
          result: true,
          approverName: true,
          decisionDate: true,
          notes: true,
        },
      },
    },
    orderBy: { levelNo: "asc" },
  },
} as const;

type AttemptRow = {
  id: string;
  projectId: string;
  attemptNo: number;
  status: "DRAFT" | "DIAJUKAN" | "APPROVED" | "DITOLAK";
  rabReady: boolean;
  afceNumber: string | null;
  documentDate: Date | null;
  basisAmount: Prisma.Decimal;
  matrixTierId: string | null;
  submittedDate: Date | null;
  approvalEmailDate: Date | null;
  decidedDate: Date | null;
  notes: string | null;
  version: number;
  matrixTier: {
    id: string;
    name: string;
    minAmount: Prisma.Decimal;
    maxAmount: Prisma.Decimal | null;
  } | null;
  boqItems: {
    id: string;
    lineNo: number;
    buildingName: string | null;
    activityName: string;
    amount: Prisma.Decimal;
    notes: string | null;
  }[];
  levels: {
    id: string;
    levelNo: number;
    positionId: string;
    positionNameSnapshot: string;
    record: {
      id: string;
      result: "APPROVED" | "DITOLAK";
      approverName: string;
      decisionDate: Date;
      notes: string | null;
    } | null;
  }[];
};

function iso(value: Date | null): string | null {
  return value ? businessDateIso(value) : null;
}

async function tierPositionIds(
  tierId: string | null,
): Promise<string[] | null> {
  if (!tierId) return null;
  const levels = await prisma.approvalMatrixTierLevel.findMany({
    where: { tierId },
    select: { levelNo: true, positionId: true },
  });
  return orderedPositionIds(levels);
}

/**
 * Bentuk untuk UI. D-49: `differsFromMatrix` dibandingkan terhadap tier yang tercatat pada
 * attempt, sehingga level manual ditandai tanpa kolom tambahan.
 */
export async function toAttemptView(row: AttemptRow) {
  const matrixIds = await tierPositionIds(row.matrixTierId);
  return {
    ...row,
    basisAmount: decimalToString(row.basisAmount),
    documentDate: iso(row.documentDate),
    submittedDate: iso(row.submittedDate),
    approvalEmailDate: iso(row.approvalEmailDate),
    decidedDate: iso(row.decidedDate),
    matrixTier: row.matrixTier
      ? {
          id: row.matrixTier.id,
          name: row.matrixTier.name,
          minAmount: decimalToString(row.matrixTier.minAmount),
          maxAmount: decimalToString(row.matrixTier.maxAmount),
        }
      : null,
    boqItems: row.boqItems.map((item) => ({
      ...item,
      amount: decimalToString(item.amount),
    })),
    levels: row.levels.map((level) => ({
      ...level,
      differsFromMatrix: differsFromMatrix(
        orderedPositionIds(row.levels),
        matrixIds,
      ),
    })),
  };
}

export async function listAttempts(projectId: string) {
  const rows = await prisma.afceAttempt.findMany({
    where: { projectId },
    select: attemptSelect,
    orderBy: { attemptNo: "desc" },
  });
  return Promise.all(rows.map(toAttemptView));
}

export async function getAttempt(attemptId: string) {
  const row = await prisma.afceAttempt.findUnique({
    where: { id: attemptId },
    select: attemptSelect,
  });
  return row ? toAttemptView(row) : null;
}

/** AC-18 dan submit: tier yang cocok dengan nilai AFCE; tanpa tier cocok pengajuan ditolak. */
export async function findTierForAmount(amount: Prisma.Decimal) {
  const tiers = await prisma.approvalMatrixTier.findMany({
    where: { isActive: true },
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
  return matchTier(tiers, "AFCE", amount);
}

export function tierNotFound(amount: Prisma.Decimal) {
  return noMatchingTierError("AFCE", amount);
}
