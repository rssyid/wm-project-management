import { resetUserPassword } from "@/domain/admin/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { resetPasswordSchema } from "@/shared/schemas/user";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requirePermission(request, "user.manage");
    const { id } = await context.params;
    const body = await parseJson(request, resetPasswordSchema);
    return ok(await resetUserPassword(id, body, actor.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
