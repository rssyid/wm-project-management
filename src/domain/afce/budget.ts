import { decimalToString, ZERO } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import { businessDateIso } from "@/shared/date";

/** docs/04 §4: anggaran rencana, anggaran resmi, dan riwayat entrinya. */
export async function getBudget(projectId: string) {
  const [project, entries] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { plannedBudget: true },
    }),
    prisma.budgetEntry.findMany({
      where: { projectId },
      select: {
        id: true,
        type: true,
        amount: true,
        effectiveDate: true,
        arSupplementId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const officialTotal = entries.reduce(
    (total, entry) => total.plus(entry.amount),
    ZERO(),
  );

  return {
    planned: decimalToString(project?.plannedBudget ?? null),
    official: decimalToString(officialTotal),
    entries: entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      amount: decimalToString(entry.amount),
      effectiveDate: businessDateIso(entry.effectiveDate),
      arSupplementId: entry.arSupplementId,
    })),
  };
}
