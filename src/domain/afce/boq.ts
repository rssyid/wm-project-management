import { versionConflict, writeAudit } from "@/domain/audit/service";
import {
  boqSelect,
  requireDraftAttempt,
  tierLevelsOf,
} from "@/domain/afce/draft";
import { replaceLevels, syncLevelsFromTier } from "@/domain/afce/levels";
import { findTierForAmount } from "@/domain/afce/queries";
import { decimal, sumDecimal } from "@/infra/decimal";
import { withTransaction } from "@/infra/tx";
import type { ReplaceBoqInput } from "@/shared/schemas/afce";

/**
 * AC-17: nilai AFCE = total BOQ, dihitung ulang selama DRAFT. Bila total memindahkan nilai ke
 * tier lain, level disalin ulang hanya bila level belum diubah manual (D-53).
 */
export async function replaceBoq(
  attemptId: string,
  input: ReplaceBoqInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await requireDraftAttempt(tx, attemptId);
    const before = await tx.boqItem.findMany({
      where: { afceAttemptId: attemptId },
      select: boqSelect,
      orderBy: { lineNo: "asc" },
    });

    const basisAmount = sumDecimal(
      input.items.map((item) => decimal(item.amount)),
    );
    const tier = basisAmount.greaterThan(0)
      ? await findTierForAmount(basisAmount)
      : null;

    const updated = await tx.afceAttempt.updateMany({
      where: { id: attemptId, version: input.version },
      data: {
        basisAmount,
        ...(tier && tier.id !== attempt.matrixTierId
          ? { matrixTierId: tier.id }
          : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw versionConflict();

    await tx.boqItem.deleteMany({ where: { afceAttemptId: attemptId } });
    await tx.boqItem.createMany({
      data: input.items.map((item, index) => ({
        afceAttemptId: attemptId,
        lineNo: index + 1,
        buildingName: item.buildingName ?? null,
        activityName: item.activityName,
        amount: decimal(item.amount),
        notes: item.notes ?? null,
      })),
    });

    if (tier && tier.id !== attempt.matrixTierId) {
      await syncLevelsFromTier(
        tx,
        { afceAttemptId: attemptId },
        attempt.matrixTierId,
        await tierLevelsOf(tx, tier.id),
      );
    }

    await writeAudit(tx, {
      actorId,
      projectId: attempt.projectId,
      entityType: "AfceAttempt",
      entityId: attemptId,
      action: "UPDATE",
      reason: "BOQ",
      before: { items: before },
      after: { lines: input.items.length, basisAmount: basisAmount.toFixed(2) },
    });
    return { id: attemptId, basisAmount: basisAmount.toFixed(2) };
  });
}

/** AC-19: urutan jabatan boleh diubah selama attempt masih DRAFT. */
export async function setLevels(
  attemptId: string,
  positionIds: readonly string[],
  version: number,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const attempt = await requireDraftAttempt(tx, attemptId);
    const updated = await tx.afceAttempt.updateMany({
      where: { id: attemptId, version },
      data: { version: { increment: 1 } },
    });
    if (updated.count === 0) throw versionConflict();
    await replaceLevels(
      tx,
      { afceAttemptId: attemptId },
      positionIds,
      actorId,
      attempt.projectId,
    );
    return { id: attemptId };
  });
}
