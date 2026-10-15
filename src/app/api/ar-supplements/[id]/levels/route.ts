import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { setArLevels } from "@/domain/afce/ar";
import { approvalLevelsSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, approvalLevelsSchema);
    return ok(await setArLevels(id, input.positionIds, input.version, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
