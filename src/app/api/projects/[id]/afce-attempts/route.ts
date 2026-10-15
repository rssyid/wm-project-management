import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { listAttempts } from "@/domain/afce/queries";
import { createAttempt } from "@/domain/afce/service";
import { createAfceAttemptSchema } from "@/shared/schemas/afce";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const attempts = await listAttempts(id);
    return ok(attempts, {
      page: 1,
      pageSize: attempts.length,
      total: attempts.length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createAfceAttemptSchema);
    return ok(await createAttempt(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
