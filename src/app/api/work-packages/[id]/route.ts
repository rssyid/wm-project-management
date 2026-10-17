import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import {
  getWorkPackage,
  updateWorkPackage,
} from "@/domain/work-package/service";
import { updateWorkPackageSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "project.write");
    const { id } = await context.params;
    return ok(await getWorkPackage(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updateWorkPackageSchema);
    return ok(await updateWorkPackage(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
