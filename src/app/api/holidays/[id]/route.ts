import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { deleteHoliday } from "@/domain/settings/service";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "settings.manage");
    const { id } = await context.params;
    return ok(await deleteHoliday(id, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
