import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { putWorkItemWeights } from "@/domain/work-item/weights";
import { putWorkItemWeightsSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, putWorkItemWeightsSchema);
    return ok(await putWorkItemWeights(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
