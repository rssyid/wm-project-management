import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { listArSupplements } from "@/domain/afce/ar-queries";
import { createArSupplement } from "@/domain/afce/ar";
import { createArSupplementSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const supplements = await listArSupplements(id);
    return ok(supplements, {
      page: 1,
      pageSize: supplements.length,
      total: supplements.length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createArSupplementSchema);
    return ok(await createArSupplement(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
