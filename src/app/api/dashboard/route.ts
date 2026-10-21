import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { listProjects } from "@/domain/project/queries";
import { getGanttProject } from "@/domain/gantt/queries";
import { projectFiltersSchema } from "@/shared/schemas/project";
import { decimal } from "@/infra/decimal";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    const filters = projectFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { data } = await listProjects(filters);
    const gantts = await Promise.all(data.map((row) => getGanttProject(row.id)));

    const byStatus: Record<string, number> = {};
    let totalProgress = decimal("0");
    let progressCount = 0;
    const deviations: { projectCode: string; projectName: string; deviationPct: number }[] = [];

    for (const g of gantts) {
      const status = g.projectStatus;
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      for (const row of g.rows) {
        if (row.type === "workItem" && row.progressPct !== null) {
          totalProgress = totalProgress.plus(decimal(row.progressPct));
          progressCount += 1;
        }
      }
    }

    return ok({
      byStatus,
      averageProgress: progressCount > 0 ? totalProgress.div(decimal(progressCount)).toFixed(2) : "0.00",
      projectCount: gantts.length,
      deviations,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
