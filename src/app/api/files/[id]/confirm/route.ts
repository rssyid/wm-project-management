import { confirmUpload } from "@/domain/files/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "file.write");
    const { id } = await context.params;
    return ok(await confirmUpload(id, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
