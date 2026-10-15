import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { submitAttempt } from "@/domain/afce/attempts";
import { submitApprovalDocSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, submitApprovalDocSchema);
    return ok(await submitAttempt(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
