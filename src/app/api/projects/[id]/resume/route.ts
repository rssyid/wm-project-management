import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { withTransaction } from "@/infra/tx";
import { resumeProject } from "@/domain/project-transition/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    return ok(await withTransaction((tx) => resumeProject(tx, id, user.id)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
