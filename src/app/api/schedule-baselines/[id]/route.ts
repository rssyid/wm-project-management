import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { updateScheduleBaseline } from "@/domain/schedule/service";
import { updateScheduleBaselineSchema } from "@/shared/schemas/schedule";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updateScheduleBaselineSchema);
    return ok(await updateScheduleBaseline(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
