import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { createScheduleRevision } from "@/domain/schedule/service";
import { createScheduleRevisionSchema } from "@/shared/schemas/schedule";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createScheduleRevisionSchema);
    return ok(await createScheduleRevision(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
