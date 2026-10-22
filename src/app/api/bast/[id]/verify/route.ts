import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { verifyBast } from "@/domain/bast/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "bast.manage");
    const { id } = await context.params;
    return ok(await verifyBast(id, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
