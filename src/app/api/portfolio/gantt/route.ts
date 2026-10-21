import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { listProjects } from "@/domain/project/queries";
import { getGanttProject } from "@/domain/gantt/queries";
import { projectFiltersSchema } from "@/shared/schemas/project";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    const filters = projectFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { data } = await listProjects(filters);
    const gantt = await Promise.all(data.map((row) => getGanttProject(row.id)));
    return ok({ projects: gantt, filters });
  } catch (error) {
    return toErrorResponse(error);
  }
}
