import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { getSurvey, upsertSurvey } from "@/domain/survey/service";
import { surveySchema } from "@/shared/schemas/survey";

type Context = { params: Promise<{ id: string }> };

/** Survei yang belum ada dibaca sebagai `data: null`, bukan 404, supaya form bisa menampilkan kosong. */
export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    return ok(await getSurvey(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, surveySchema);
    return ok(await upsertSurvey(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
