import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { recordDecision } from "@/domain/afce/decision";
import { approvalDecisionSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ levelId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "approval.record");
    const { levelId } = await context.params;
    const input = await parseJson(request, approvalDecisionSchema);
    return ok(await recordDecision(levelId, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
