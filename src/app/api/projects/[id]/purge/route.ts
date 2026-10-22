import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { purgeProject, deleteR2Files } from "@/domain/project/purge";
import { purgeProjectSchema } from "@/shared/schemas/bast";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.purge");
    const { id } = await context.params;
    const input = await parseJson(request, purgeProjectSchema);
    const result = await purgeProject(id, input.code, user.id);
    // Hapus objek R2 setelah transaksi DB commit (docs/02 §4).
    await deleteR2Files(result.fileKeys);
    return ok({ id: result.id, code: result.code });
  } catch (error) {
    return toErrorResponse(error);
  }
}
