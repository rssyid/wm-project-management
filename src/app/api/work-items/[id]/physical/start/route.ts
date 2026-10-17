import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { startPhysical } from "@/domain/physical/service";
import { startPhysicalSchema } from "@/shared/schemas/physical";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, startPhysicalSchema);
    return ok(await startPhysical(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
