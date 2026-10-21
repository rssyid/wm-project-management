import { GanttMatrix } from "@/components/gantt/gantt-matrix";
import { GanttProjectData } from "@/domain/gantt/queries";
import {
  projectFiltersSchema,
  type ProjectFilters,
} from "@/shared/schemas/project";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function fetchPortfolioGantt(
  filters: ProjectFilters,
): Promise<GanttProjectData[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status.length) params.set("status", filters.status.join(","));
  if (filters.companyIds.length)
    params.set("companyId", filters.companyIds.join(","));
  if (filters.regionIds.length)
    params.set("regionId", filters.regionIds.join(","));
  if (filters.categoryId) params.set("categoryId", filters.categoryId);

  const response = await fetch(`/api/portfolio/gantt?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Gagal memuat Gantt portofolio.");
  }
  const body = await response.json();
  return body.data?.projects ?? [];
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const filters = projectFiltersSchema.parse({
    q: query.q ?? undefined,
    status: query.status ?? undefined,
    companyIds: query.companyId ?? undefined,
    regionIds: query.regionId ?? undefined,
    categoryId: query.categoryId ?? undefined,
    page: query.page ?? "1",
  });

  const gantts = await fetchPortfolioGantt(filters);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold">Gantt Portofolio</h2>
      <p className="text-sm text-ink-muted">
        Gantt matriks mingguan untuk proyek terfilter. Setiap proyek ditampilkan
        sebagai blok terpisah.
      </p>
      {gantts.length === 0 ? (
        <div className="rounded-sm border border-line bg-panel p-6 text-center text-sm text-ink-muted">
          Tidak ada proyek yang cocok dengan filter.
        </div>
      ) : (
        <>
          {gantts.map((g) => (
            <section
              key={g.projectId}
              className="overflow-hidden rounded-sm border border-line bg-panel"
            >
              <div className="border-b border-line bg-surface p-3">
                <h3 className="text-sm font-semibold text-ink">
                  {g.projectCode} · {g.projectName}
                </h3>
                <p className="text-xs text-ink-muted">
                  Status: {g.projectStatus}
                </p>
              </div>
              <GanttMatrix data={g} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
