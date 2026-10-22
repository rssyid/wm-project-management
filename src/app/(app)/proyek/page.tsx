import { ProjectListView } from "@/components/project/project-list-view";
import { listProjects } from "@/domain/project/queries";
import { prisma } from "@/infra/db";
import { getSessionUser } from "@/infra/session";
import { can } from "@/shared/permissions";
import { projectFiltersSchema } from "@/shared/schemas/project";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

// Route /proyek membaca searchParams dan Prisma langsung; tidak dapat
// di-prerender statis, blocking render per permintaan. cacheComponents
// diaktifkan di next.config, jadi dynamic/revalidate tidak bisa dipakai.
export const instant = false;

export default async function ProjectListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const filters = projectFiltersSchema.parse({
    q: single(query.q),
    status: single(query.status),
    companyIds: single(query.companyId),
    regionIds: single(query.regionId),
    categoryId: single(query.categoryId),
    page: single(query.page) || "1",
  });

  const [{ data, total }, regions, companies, categories, user] =
    await Promise.all([
      listProjects(filters),
      prisma.region.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.company.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      prisma.projectCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      getSessionUser(),
    ]);

  return (
    <ProjectListView
      rows={data}
      total={total}
      page={filters.page}
      pageSize={filters.pageSize}
      canWrite={can(user?.role ?? "MANAGEMENT_VIEWER", "project.write")}
      filters={{
        q: filters.q ?? "",
        status: filters.status.join(","),
        companyId: filters.companyIds.join(","),
        regionId: filters.regionIds.join(","),
        categoryId: filters.categoryId ?? "",
      }}
      options={{ regions, companies, categories }}
    />
  );
}
