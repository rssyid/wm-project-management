import { GanttMatrix } from "@/components/gantt/gantt-matrix";
import { getPortfolioGantt } from "@/domain/gantt/queries";
import { projectFiltersSchema } from "@/shared/schemas/project";
import { connection } from "next/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const query = await searchParams;
  const filters = projectFiltersSchema.parse({
    q: query.q ?? undefined,
    status: query.status ?? undefined,
    companyIds: query.companyId ?? undefined,
    regionIds: query.regionId ?? undefined,
    categoryId: query.categoryId ?? undefined,
    page: query.page ?? "1",
  });

  const gantts = await getPortfolioGantt(filters);

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
