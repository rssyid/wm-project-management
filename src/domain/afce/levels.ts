import { writeAudit } from "@/domain/audit/service";
import type { Tx } from "@/infra/tx";
import { DomainError } from "@/shared/errors";

export type LevelLike = { levelNo: number; positionId: string };
export type TierLevelLike = LevelLike & { position?: { name: string } | null };

export function orderedPositionIds(levels: readonly LevelLike[]): string[] {
  return [...levels]
    .sort((left, right) => left.levelNo - right.levelNo)
    .map((level) => level.positionId);
}

export function sameLevels(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((positionId, index) => positionId === right[index])
  );
}

/**
 * D-49: "berbeda dari matriks" dihitung saat baca dengan membandingkan urutan jabatan snapshot
 * terhadap tier, jadi tidak ada kolom penanda yang bisa basi setelah tier diubah.
 */
export function differsFromMatrix(
  snapshotPositionIds: readonly string[],
  tierLevelPositionIds: readonly string[] | null,
): boolean {
  if (tierLevelPositionIds === null) return false;
  return !sameLevels(snapshotPositionIds, tierLevelPositionIds);
}

export type LevelOwner = {
  afceAttemptId?: string;
  arSupplementId?: string;
};

/**
 * D-53: level disalin ulang dari tier baru hanya bila level saat ini masih sama persis dengan
 * tier yang dipakai sebelumnya. Bila sudah diubah manual, level tidak ditimpa dan ditandai
 * berbeda dari matriks.
 */
export async function syncLevelsFromTier(
  tx: Tx,
  owner: LevelOwner,
  previousTierId: string | null,
  tierLevels: readonly TierLevelLike[],
): Promise<boolean> {
  const current = await tx.approvalLevelSnapshot.findMany({
    where: owner,
    select: { levelNo: true, positionId: true },
  });
  const previousTierLevels =
    previousTierId === null
      ? []
      : await tx.approvalMatrixTierLevel.findMany({
          where: { tierId: previousTierId },
          select: { levelNo: true, positionId: true },
        });

  const untouched =
    current.length === 0 ||
    sameLevels(
      orderedPositionIds(current),
      orderedPositionIds(previousTierLevels),
    );
  if (!untouched) return false;

  await tx.approvalLevelSnapshot.deleteMany({ where: owner });
  await tx.approvalLevelSnapshot.createMany({
    data: [...tierLevels]
      .sort((left, right) => left.levelNo - right.levelNo)
      .map((level) => {
        if (!level.position) {
          throw new DomainError(
            "PRECONDITION_FAILED",
            "Jabatan di tier matriks tidak ditemukan.",
          );
        }
        return {
          ...owner,
          levelNo: level.levelNo,
          positionId: level.positionId,
          positionNameSnapshot: level.position.name,
        };
      }),
  });
  return true;
}

export async function replaceLevels(
  tx: Tx,
  owner: LevelOwner,
  positionIds: readonly string[],
  actorId: string,
  projectId: string,
): Promise<void> {
  const positions = await tx.approvalPosition.findMany({
    where: { id: { in: [...positionIds] } },
    select: { id: true, name: true },
  });
  if (positions.length !== positionIds.length) {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "Jabatan approver yang dipilih tidak ditemukan.",
    );
  }
  const nameById = new Map(
    positions.map((position) => [position.id, position.name]),
  );

  const before = await tx.approvalLevelSnapshot.findMany({
    where: owner,
    select: { levelNo: true, positionId: true, positionNameSnapshot: true },
    orderBy: { levelNo: "asc" },
  });

  await tx.approvalLevelSnapshot.deleteMany({ where: owner });
  await tx.approvalLevelSnapshot.createMany({
    data: positionIds.map((positionId, index) => {
      const name = nameById.get(positionId);
      if (!name) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Jabatan approver yang dipilih tidak ditemukan.",
        );
      }
      return {
        ...owner,
        levelNo: index + 1,
        positionId,
        positionNameSnapshot: name,
      };
    }),
  });

  await writeAudit(tx, {
    actorId,
    projectId,
    entityType: "ArSupplement",
    entityId: owner.arSupplementId ?? owner.afceAttemptId ?? "",
    action: "UPDATE",
    reason: "Level approval",
    before: { levels: before },
    after: { levels: positionIds },
  });
}
