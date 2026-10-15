import { decimal } from "@/infra/decimal";
import type { Tx } from "@/infra/tx";
import { DomainError } from "@/shared/errors";

export type AttemptState = {
  id: string;
  projectId: string;
  status: "DRAFT" | "DIAJUKAN" | "APPROVED" | "DITOLAK";
  basisAmount: ReturnType<typeof decimal>;
  matrixTierId: string | null;
  version: number;
};

export const boqSelect = {
  lineNo: true,
  buildingName: true,
  activityName: true,
  amount: true,
  notes: true,
} as const;

/** Setelah diajukan nilai dan level terkunci; hanya attempt DRAFT yang boleh diubah. */
export async function requireDraftAttempt(
  tx: Tx,
  attemptId: string,
): Promise<AttemptState> {
  const attempt = await tx.afceAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      projectId: true,
      status: true,
      basisAmount: true,
      matrixTierId: true,
      version: true,
    },
  });
  if (!attempt)
    throw new DomainError("NOT_FOUND", "Attempt AFCE tidak ditemukan.");
  if (attempt.status !== "DRAFT") {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "Attempt AFCE sudah diajukan sehingga isinya terkunci.",
    );
  }
  return attempt;
}

export async function tierLevelsOf(tx: Tx, tierId: string) {
  return tx.approvalMatrixTierLevel.findMany({
    where: { tierId },
    select: {
      levelNo: true,
      positionId: true,
      position: { select: { name: true } },
    },
  });
}
