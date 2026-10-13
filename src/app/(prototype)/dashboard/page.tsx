import { PageHeader } from "@/components/page-header";
import { formatPercent } from "@/shared/format";
import { ProjectTable } from "@/prototype/project-table";
import { SAMPLE_KPI, SAMPLE_PROJECTS } from "@/prototype/sample-data";

const KPIS = [
  { label: "Proyek aktif", value: String(SAMPLE_KPI.activeProjects) },
  { label: "EWS merah", value: String(SAMPLE_KPI.ewsRed) },
  { label: "EWS kuning", value: String(SAMPLE_KPI.ewsYellow) },
  {
    label: "Progres berbobot",
    value: formatPercent(SAMPLE_KPI.weightedProgress),
  },
];

export default function DashboardPage() {
  const byDeviation = [...SAMPLE_PROJECTS].sort(
    (a, b) => Number(b.ews.deviation) - Number(a.ews.deviation),
  );

  return (
    <>
      <PageHeader title="Dashboard" />
      <dl className="mb-8 grid grid-cols-2 gap-y-4 border-y bg-panel py-4 md:grid-cols-4 md:divide-x">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="px-4">
            <dt className="text-dense text-ink-muted">{kpi.label}</dt>
            <dd className="text-2xl font-bold text-ink tabular-nums">
              {kpi.value}
            </dd>
          </div>
        ))}
      </dl>
      <h2 className="mb-3 text-base font-semibold">Deviasi terbesar</h2>
      <ProjectTable
        projects={byDeviation.slice(0, 10)}
        caption="Proyek dengan deviasi EWS terbesar"
      />
      <p className="mt-6 text-dense text-ink-muted">
        Kurva S portofolio dibuat di F5.
      </p>
    </>
  );
}
