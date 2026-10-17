import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { createWorkItem } from "@/domain/work-item/service";
import { putWorkItemWeights } from "@/domain/work-item/weights";
import {
  createWorkItemSchema,
  putWorkItemWeightsSchema,
} from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, createWorkItemSchema);
    return ok(await createWorkItem(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, putWorkItemWeightsSchema);
    return ok(await putWorkItemWeights(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
