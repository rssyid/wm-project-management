import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { optionalBusinessDateField } from "@/shared/schemas/fields";

const auditLogsFilterSchema = z.object({
  projectId: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  actorId: z.string().trim().optional(),
  from: optionalBusinessDateField,
  to: optionalBusinessDateField,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    const filters = auditLogsFilterSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const where: Prisma.AuditLogWhereInput = {};
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok(
      rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        before: row.before,
        after: row.after,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
      { page: filters.page, pageSize: filters.pageSize, total },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
