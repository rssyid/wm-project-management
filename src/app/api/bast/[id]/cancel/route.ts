import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { cancelBast } from "@/domain/bast/service";
import { cancelBastSchema } from "@/shared/schemas/bast";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "bast.manage");
    const { id } = await context.params;
    const input = await parseJson(request, cancelBastSchema);
    return ok(await cancelBast(id, input.reason, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
