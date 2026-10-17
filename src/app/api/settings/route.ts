import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { getSettings, updateSettings } from "@/domain/settings/service";
import { updateSettingsSchema } from "@/shared/schemas/settings";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    return ok(await getSettings());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission(request, "settings.manage");
    const input = await parseJson(request, updateSettingsSchema);
    return ok(await updateSettings(input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
