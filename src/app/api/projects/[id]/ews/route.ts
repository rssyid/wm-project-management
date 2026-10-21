import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { getGanttProject } from "@/domain/gantt/queries";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const gantt = await getGanttProject(id);
    return ok({ projectId: id, rows: gantt.rows, weeks: gantt.weeks });
  } catch (error) {
    return toErrorResponse(error);
  }
}
