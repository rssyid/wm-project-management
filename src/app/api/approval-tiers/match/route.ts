import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { matchTierForAmount } from "@/domain/approval-matrix/service";
import { approvalTierMatchSchema } from "@/shared/schemas/approval";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { doc, amount } = approvalTierMatchSchema.parse(params);
    return ok(await matchTierForAmount(doc, amount));
  } catch (error) {
    return toErrorResponse(error);
  }
}
