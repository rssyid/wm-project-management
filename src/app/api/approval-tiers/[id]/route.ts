import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { updateTier } from "@/domain/approval-matrix/service";
import { updateApprovalTierSchema } from "@/shared/schemas/approval";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "approval.matrix.manage");
    const { id } = await context.params;
    const input = await parseJson(request, updateApprovalTierSchema);
    return ok(await updateTier(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
