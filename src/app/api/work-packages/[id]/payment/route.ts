import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { updatePayment } from "@/domain/delivery/service";
import { updatePaymentSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updatePaymentSchema);
    return ok(await updatePayment(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
