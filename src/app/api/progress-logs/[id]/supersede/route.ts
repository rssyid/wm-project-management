import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { supersedeProgressLog } from "@/domain/physical/service";
import { supersedeProgressLogSchema } from "@/shared/schemas/physical";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, supersedeProgressLogSchema);
    return ok(await supersedeProgressLog(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
