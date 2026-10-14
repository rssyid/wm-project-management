import { createQuickMaterial } from "@/domain/master/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { quickMaterialSchema } from "@/shared/schemas/master";

/** docs/04 §2: `POST /api/master/materials/quick` membuat material minimal. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, "master.write");
    const body = await parseJson(request, quickMaterialSchema);
    return ok(await createQuickMaterial(body, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
