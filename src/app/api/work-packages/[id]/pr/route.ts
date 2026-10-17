import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { createPurchaseRequest } from "@/domain/work-package/service";
import { createPurchaseRequestSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createPurchaseRequestSchema);
    return ok(await createPurchaseRequest(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
