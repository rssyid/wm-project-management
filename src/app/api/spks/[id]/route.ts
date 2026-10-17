import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { updateSpk } from "@/domain/spk/service";
import { updateSpkSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updateSpkSchema);
    return ok(await updateSpk(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
