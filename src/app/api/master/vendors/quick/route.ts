import { createQuickVendor } from "@/domain/master/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { quickVendorSchema } from "@/shared/schemas/master";

/** docs/04 §2: `POST /api/master/vendors/quick` membuat vendor minimal dari nama. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, "master.write");
    const body = await parseJson(request, quickVendorSchema);
    return ok(await createQuickVendor(body, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
