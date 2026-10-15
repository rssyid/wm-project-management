import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { updateArSupplement } from "@/domain/afce/ar";
import { updateArSupplementSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updateArSupplementSchema);
    return ok(await updateArSupplement(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
