import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { updateWorkItem } from "@/domain/work-item/service";
import { updateWorkItemWeights } from "@/domain/work-item/weights";
import {
  updateWorkItemSchema,
  workItemWeightSchema,
} from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, updateWorkItemSchema);
    return ok(await updateWorkItem(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, workItemWeightSchema);
    return ok(await updateWorkItemWeights(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
