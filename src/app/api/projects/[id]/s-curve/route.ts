import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { getGanttProject } from "@/domain/gantt/queries";
import { decimal } from "@/infra/decimal";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const gantt = await getGanttProject(id);

    const sCurve = gantt.weeks.map((w, i) => {
      let planned = decimal("0");
      let actual = decimal("0");
      let count = 0;
      for (const row of gantt.rows) {
        if (row.type === "workItem" && row.progressPct !== null) {
          actual = actual.plus(decimal(row.progressPct));
          count += 1;
        }
        const cell = gantt.rows.find((r) => r.id === row.id)?.cells?.[i];
        if (cell?.color === "base" || cell?.color === "rev1" || cell?.color === "rev2") {
          planned = planned.plus(decimal((i + 1) / gantt.weeks.length).times(decimal("100")));
        }
      }
      return {
        week: w.label,
        planned: count > 0 ? Number(planned.div(decimal(count)).toFixed(2)) : 0,
        actual: count > 0 ? Number(actual.div(decimal(count)).toFixed(2)) : 0,
      };
    });

    return ok({ weeks: gantt.weeks, rows: gantt.rows, sCurve });
  } catch (error) {
    return toErrorResponse(error);
  }
}
