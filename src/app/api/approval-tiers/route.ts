import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requireRuntime } from "@/app/api/_lib/dynamic";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { createTier, listTiers } from "@/domain/approval-matrix/service";
import { createApprovalTierSchema } from "@/shared/schemas/approval";

export async function GET(request: Request) {
  try {
    await requireRuntime();
    await requirePermission(request, "read");
    const tiers = await listTiers();
    return ok(tiers, {
      page: 1,
      pageSize: tiers.length,
      total: tiers.length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, "approval.matrix.manage");
    const input = await parseJson(request, createApprovalTierSchema);
    return ok(await createTier(input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
