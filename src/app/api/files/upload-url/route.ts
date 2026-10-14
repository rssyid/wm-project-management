import { createUploadUrl } from "@/domain/files/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { uploadUrlSchema } from "@/shared/schemas/file";

/** docs/04 §9: hanya SA dan SP yang boleh membuat URL unggah. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, "file.write");
    const body = await parseJson(request, uploadUrlSchema);
    return ok(await createUploadUrl(body, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
