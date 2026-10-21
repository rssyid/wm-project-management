import { PageHeader } from "@/components/page-header";
import { DashboardKpis } from "@/components/dashboard/kpis";
import { DeviationsTable } from "@/components/dashboard/deviations";
import { SCurveChart } from "@/components/dashboard/s-curve";
import { WeeklyLogReminder } from "@/components/dashboard/weekly-reminder";
import { fetchDashboard } from "@/domain/dashboard/queries";
import { validateDashboardFilters } from "@/domain/dashboard/queries";
import { redirect } from "next/navigation";

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

  let dashboard: Awaited<ReturnType<typeof fetchDashboard>>;
  try {
    dashboard = await fetchDashboard(filters);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "UNAUTHENTICATED" || err.message === "Silakan masuk terlebih dahulu.") {
      redirect("/login");
    }
    throw error;
  }

  const scurveData = dashboard.sCurve.length
    ? dashboard.sCurve.map((s) => ({
        week: s.week,
        planned: s.planned,
        actual: s.actual,
      }))
    : [{ week: "W1", planned: 0, actual: 0 }];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan portofolio, EWS, dan progres."
      />
      <DashboardKpis
        projectCount={dashboard.projectCount}
        averageProgress={dashboard.averageProgress}
        byStatus={dashboard.byStatus}
      />
      <DeviationsTable deviations={dashboard.deviations} />
      <SCurveChart data={scurveData} />
      <WeeklyLogReminder
        count={dashboard.ews.length}
        projectCount={dashboard.projectCount}
      />
    </>
  );
}
