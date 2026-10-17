import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { startProduction } from "@/domain/work-package/service";
import { startProductionSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, startProductionSchema);
    return ok(await startProduction(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
