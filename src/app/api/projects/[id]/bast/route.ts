import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { submitBast } from "@/domain/bast/service";
import { submitBastSchema } from "@/shared/schemas/bast";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, submitBastSchema);
    return ok(
      await submitBast(
        id,
        input.number,
        input.date ? new Date(input.date) : null,
        input.fileId,
        user.id,
      ),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
