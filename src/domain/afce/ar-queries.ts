import { decimalToString } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import { businessDateIso } from "@/shared/date";

const supplementSelect = {
  id: true,
  number: true,
  amount: true,
  reason: true,
  date: true,
  status: true,
  version: true,
  submittedDate: true,
  approvalEmailDate: true,
  decidedDate: true,
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
        },
      },
    },
    orderBy: { levelNo: "asc" },
  },
} as const;

/** Bentuk untuk UI: nominal dan tanggal dikirim sebagai string (rule 20). */
export async function listArSupplements(projectId: string) {
  const rows = await prisma.arSupplement.findMany({
    where: { projectId },
    select: supplementSelect,
    orderBy: { date: "desc" },
  });
  return rows.map((row) => ({
    ...row,
    amount: decimalToString(row.amount),
    date: businessDateIso(row.date),
    submittedDate: row.submittedDate
      ? businessDateIso(row.submittedDate)
      : null,
    approvalEmailDate: row.approvalEmailDate
      ? businessDateIso(row.approvalEmailDate)
      : null,
    decidedDate: row.decidedDate ? businessDateIso(row.decidedDate) : null,
    levels: row.levels.map((level) => ({
      ...level,
      record: level.record
        ? {
            ...level.record,
            decisionDate: businessDateIso(level.record.decisionDate),
          }
        : null,
    })),
  }));
}
