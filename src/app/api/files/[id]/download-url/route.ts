import { createDownloadUrl } from "@/domain/files/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";

type Context = { params: Promise<{ id: string }> };

/** docs/04 §9: semua peran boleh mengunduh lewat URL berumur pendek. */
export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    return ok(await createDownloadUrl(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
