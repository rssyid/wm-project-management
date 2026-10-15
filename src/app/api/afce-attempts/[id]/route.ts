import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { getAttempt } from "@/domain/afce/queries";
import { updateAttempt } from "@/domain/afce/attempts";
import { DomainError } from "@/shared/errors";
import { updateAfceAttemptSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const attempt = await getAttempt(id);
    if (!attempt)
      throw new DomainError("NOT_FOUND", "Attempt AFCE tidak ditemukan.");
    return ok(attempt);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updateAfceAttemptSchema);
    return ok(await updateAttempt(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
