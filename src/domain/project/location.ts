import type { Tx } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import type { ProjectEstateInput } from "@/shared/schemas/project";

/**
 * AC-11: semua Estate proyek milik Company proyek dan Block berasal dari Estate baris itu.
 * Pelanggaran adalah prasyarat yang tidak terpenuhi, bukan role, jadi jawabannya 409.
 */
export async function validateProjectEstates(
  tx: Tx,
  companyId: string,
  estates: readonly ProjectEstateInput[],
): Promise<void> {
  const estateIds = estates.map((estate) => estate.estateId);
  const rows = await tx.estate.findMany({
    where: { id: { in: estateIds } },
    select: { id: true, code: true, name: true, companyId: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const estate of estates) {
    const row = byId.get(estate.estateId);
    if (!row) {
      throw new DomainError("PRECONDITION_FAILED", "Estate tidak ditemukan.");
    }
    if (row.companyId !== companyId) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Estate ${row.code} bukan milik Company proyek.`,
      );
    }
  }

  const blockIds = estates
    .map((estate) => estate.blockId)
    .filter((blockId): blockId is string => Boolean(blockId));
  if (blockIds.length === 0) return;

  const blocks = await tx.block.findMany({
    where: { id: { in: blockIds } },
    select: { id: true, blockCode: true, estateId: true },
  });
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  for (const estate of estates) {
    if (!estate.blockId) continue;
    const block = blockById.get(estate.blockId);
    if (!block) {
      throw new DomainError("PRECONDITION_FAILED", "Block tidak ditemukan.");
    }
    if (block.estateId !== estate.estateId) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Block ${block.blockCode} bukan milik Estate yang dipilih.`,
      );
    }
  }
}

export function estateRows(estates: readonly ProjectEstateInput[]) {
  return estates.map((estate) => ({
    estateId: estate.estateId,
    blockId: estate.blockId ?? null,
    isPrimary: estate.isPrimary,
  }));
}
