import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { cancelWorkItem } from "@/domain/work-item/service";
import { cancelWithWeightsSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, cancelWithWeightsSchema);
    return ok(await cancelWorkItem(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
