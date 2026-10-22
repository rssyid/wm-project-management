import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { withTransaction } from "@/infra/tx";
import { cancelProject } from "@/domain/project-transition/service";
import {
  optionalBusinessDateField,
  reasonField,
} from "@/shared/schemas/fields";
import { z } from "zod";

const cancelSchema = z.object({
  reason: reasonField,
  cancelledAt: optionalBusinessDateField,
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.cancel");
    const { id } = await context.params;
    const input = await parseJson(request, cancelSchema);
    return ok(
      await withTransaction((tx) =>
        cancelProject(
          tx,
          id,
          input.reason,
          user.id,
          input.cancelledAt ? new Date(input.cancelledAt) : new Date(),
        ),
      ),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
