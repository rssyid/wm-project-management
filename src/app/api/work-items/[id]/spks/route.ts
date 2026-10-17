import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { listSpks, createSpk } from "@/domain/spk/service";
import { createSpkSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "project.write");
    const { id } = await context.params;
    return ok(await listSpks(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createSpkSchema);
    return ok(await createSpk(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
