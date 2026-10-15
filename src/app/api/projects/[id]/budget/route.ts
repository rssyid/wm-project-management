import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { getBudget } from "@/domain/afce/ar";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    return ok(await getBudget(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
