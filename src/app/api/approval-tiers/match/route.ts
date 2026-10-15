import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requireRuntime } from "@/app/api/_lib/dynamic";
import { requirePermission } from "@/app/api/_lib/session";
import { matchTierForAmount } from "@/domain/approval-matrix/service";
import { approvalTierMatchSchema } from "@/shared/schemas/approval";

export async function GET(request: Request) {
  try {
    await requireRuntime();
    await requirePermission(request, "read");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { doc, amount } = approvalTierMatchSchema.parse(params);
    return ok(await matchTierForAmount(doc, amount));
  } catch (error) {
    return toErrorResponse(error);
  }
}
