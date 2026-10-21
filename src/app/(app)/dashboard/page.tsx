import { PageHeader } from "@/components/page-header";
import { DashboardKpis } from "@/components/dashboard/kpis";
import { DeviationsTable } from "@/components/dashboard/deviations";
import { SCurveChart } from "@/components/dashboard/s-curve";
import { WeeklyLogReminder } from "@/components/dashboard/weekly-reminder";
import { fetchDashboard } from "@/domain/dashboard/queries";
import { validateDashboardFilters } from "@/domain/dashboard/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const filters = validateDashboardFilters({
    q: single(query.q),
    status: single(query.status),
    companyIds: single(query.companyId),
    regionIds: single(query.regionId),
    categoryId: single(query.categoryId),
    page: single(query.page) || "1",
  });

  const dashboard = await fetchDashboard(filters);

  const scurveData = [
    { week: "W1", planned: 6.25, actual: 5.0 },
    { week: "W2", planned: 12.5, actual: 10.0 },
    { week: "W3", planned: 18.75, actual: 18.0 },
    { week: "W4", planned: 25.0, actual: 22.0 },
    { week: "W5", planned: 31.25, actual: 35.0 },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan portofolio, EWS, dan progres." />
      <DashboardKpis
        projectCount={dashboard.projectCount}
        averageProgress={dashboard.averageProgress}
        byStatus={dashboard.byStatus}
      />
      <DeviationsTable deviations={dashboard.deviations} />
      <SCurveChart data={scurveData} />
      <WeeklyLogReminder count={0} projectCount={dashboard.projectCount} />
    </>
  );
}
