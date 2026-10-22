import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { getProject } from "@/domain/project/queries";
import { softDeleteProject } from "@/domain/project/purge";
import { updateProject } from "@/domain/project/service";
import { DomainError } from "@/shared/errors";
import { updateProjectSchema } from "@/shared/schemas/project";
import { reasonField } from "@/shared/schemas/fields";
import { z } from "zod";

const deleteProjectSchema = z.object({
  reason: reasonField,
});

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const project = await getProject(id);
    if (!project) throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
    return ok(project);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = updateProjectSchema.parse(await request.json());
    return ok(await updateProject(id, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.delete");
    const { id } = await context.params;
    const input = await parseJson(request, deleteProjectSchema);
    return ok(await softDeleteProject(id, input.reason, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
