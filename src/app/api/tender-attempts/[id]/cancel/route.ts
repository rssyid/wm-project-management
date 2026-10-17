import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { cancelTenderAttempt } from "@/domain/tender/service";
import { cancelTenderAttemptSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, cancelTenderAttemptSchema);
    return ok(await cancelTenderAttempt(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
