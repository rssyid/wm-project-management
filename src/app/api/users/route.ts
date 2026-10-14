import { createUserAccount, listUsers } from "@/domain/admin/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { createUserSchema } from "@/shared/schemas/user";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "user.manage");
    return ok(await listUsers());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "user.manage");
    const body = await parseJson(request, createUserSchema);
    return ok(await createUserAccount(body, actor.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
