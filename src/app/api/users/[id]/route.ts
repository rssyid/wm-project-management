import { updateUserAccount } from "@/domain/admin/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { updateUserSchema } from "@/shared/schemas/user";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requirePermission(request, "user.manage");
    const { id } = await context.params;
    const body = await parseJson(request, updateUserSchema);
    return ok(await updateUserAccount(id, body, actor.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
