import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { replaceProjectEstates } from "@/domain/project/service";
import { replaceProjectEstatesSchema } from "@/shared/schemas/project";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, replaceProjectEstatesSchema);
    return ok(
      await replaceProjectEstates(id, input.estates, input.version, user.id),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
