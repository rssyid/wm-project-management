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
    const ewsByProject: Array<{ projectId: string; projectCode: string; projectName: string; level: string | null; label: string }> = [];
    const sCurve: Array<{ week: string; planned: number; actual: number }> = [];

    for (const g of gantts) {
      const status = g.projectStatus;
      byStatus[status] = (byStatus[status] ?? 0) + 1;

      let projectActual = decimal("0");
      let projectWeightTotal = decimal("0");

      for (const row of g.rows) {
        if (row.type === "workItem" && row.progressPct !== null) {
          const pct = decimal(row.progressPct);
          totalProgress = totalProgress.plus(pct);
          progressCount += 1;

          // project-level EWS: use workItem weight from Gantt (level 1 = workItem)
          projectActual = projectActual.plus(pct);
          projectWeightTotal = projectWeightTotal.plus(decimal("1"));
        }
        if (row.ewsLevel) {
          const labelMap: Record<string, string> = {
            GREEN: "Aman",
            YELLOW: "Perlu perhatian",
            RED: "Tertunda",
          };
          ewsByProject.push({
            projectId: g.projectId,
            projectCode: g.projectCode,
            projectName: g.projectName,
            level: row.ewsLevel,
            label: labelMap[row.ewsLevel] ?? row.ewsLevel,
          });
        }
      }

      if (projectWeightTotal.greaterThan(decimal("0"))) {
        const avg = projectActual.div(projectWeightTotal);
        const planned = decimal("50");
        const deviation = avg.minus(planned);
        deviations.push({
          projectCode: g.projectCode,
          projectName: g.projectName,
          deviationPct: Number(deviation.toFixed(2)),
        });
      }
    }

    deviations.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
    const topDeviations = deviations.slice(0, 10);

    return ok({
      byStatus,
      averageProgress: progressCount > 0 ? totalProgress.div(decimal(progressCount)).toFixed(2) : "0.00",
      projectCount: gantts.length,
      deviations: topDeviations,
      ews: ewsByProject,
      sCurve,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
