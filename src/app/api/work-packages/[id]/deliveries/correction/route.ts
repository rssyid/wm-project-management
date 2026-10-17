import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { createDeliveryCorrection } from "@/domain/delivery/service";
import { createDeliveryCorrectionSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createDeliveryCorrectionSchema);
    return ok(await createDeliveryCorrection(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
