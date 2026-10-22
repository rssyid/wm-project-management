import { redirect } from "next/navigation";

import { prisma } from "@/infra/db";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/infra/session";

async function listAuditLogs({
  projectId,
  entityType,
  actorId,
  from,
  to,
  page,
  pageSize,
}: {
  projectId?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}) {
  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;
  if (from || to) {
    where.createdAt = {} as Record<string, unknown>;
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, total };
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: {
    projectId?: string;
    entityType?: string;
    actorId?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const page = Math.max(Number(searchParams.page ?? "1"), 1);
  const pageSize = Math.min(
    Math.max(Number(searchParams.pageSize ?? "25"), 1),
    100,
  );

  const { rows, total } = await listAuditLogs({
    projectId: searchParams.projectId,
    entityType: searchParams.entityType,
    actorId: searchParams.actorId,
    from: searchParams.from,
    to: searchParams.to,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <PageHeader title="Log audit" />
      <div className="max-w-[720px]">
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-panel p-4">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Proyek
            </label>
            <input
              defaultValue={searchParams.projectId ?? ""}
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="ID proyek"
            />
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Entitas
            </label>
            <input
              defaultValue={searchParams.entityType ?? ""}
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Project / BastDocument"
            />
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Dari / sampai
            </label>
            <div className="flex gap-2">
              <input
                defaultValue={searchParams.from ?? ""}
                type="date"
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <input
                defaultValue={searchParams.to ?? ""}
                type="date"
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-panel">
          <table className="w-full text-dense" aria-label="Log audit">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Waktu
                </th>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Aktor
                </th>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Entitas
                </th>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Aksi
                </th>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Sebelum
                </th>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Sesudah
                </th>
                <th className="px-3 py-2 text-left font-medium text-ink-muted">
                  Alasan
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="h-10 border-t">
                  <td className="px-3 py-2 text-sm">
                    {new Date(row.createdAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {row.actor?.name ?? row.actor?.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-sm">{row.entityType}</td>
                  <td className="px-3 py-2 text-sm">{row.action}</td>
                  <td className="px-3 py-2 text-sm text-ink-muted">
                    {row.before ? JSON.stringify(row.before) : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-ink-muted">
                    {row.after ? JSON.stringify(row.after) : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm">{row.reason ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-ink-muted"
                  >
                    Tidak ada log audit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <p className="mt-4 text-sm text-ink-muted">
            Halaman {page} dari {totalPages} ({total} data)
          </p>
        )}
      </div>
    </>
  );
}
