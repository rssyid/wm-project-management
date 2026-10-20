import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { listHolidays, createHoliday } from "@/domain/settings/service";
import { createHolidaySchema } from "@/shared/schemas/settings";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    return ok(await listHolidays());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, "settings.manage");
    const input = await parseJson(request, createHolidaySchema);
    return ok(await createHoliday(input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
