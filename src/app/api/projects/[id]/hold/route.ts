import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { withTransaction } from "@/infra/tx";
import { holdProject } from "@/domain/project-transition/service";
import { reasonField } from "@/shared/schemas/fields";
import { z } from "zod";

const holdSchema = z.object({
  reason: reasonField,
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, holdSchema);
    return ok(await withTransaction((tx) => holdProject(tx, id, input.reason, user.id)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
