import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { restoreProject } from "@/domain/project/purge";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.delete");
    const { id } = await context.params;
    return ok(await restoreProject(id, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
