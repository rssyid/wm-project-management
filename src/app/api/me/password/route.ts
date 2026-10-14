import { changePasswordSchema } from "@/shared/schemas/auth";
import { parseJson, requireUser } from "@/app/api/_lib/session";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { changeOwnPassword } from "@/domain/auth/service";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await parseJson(request, changePasswordSchema);
    await changeOwnPassword(user.id, body.newPassword);
    return ok({ mustChangePassword: false });
  } catch (error) {
    return toErrorResponse(error);
  }
}
