import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { getProjectHistory } from "@/domain/project/queries";
import { DomainError } from "@/shared/errors";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const project = await getProjectHistory(id);
    if (project.statusHistory.length === 0 && project.auditLogs.length === 0) {
      throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
    }
    return ok(project);
  } catch (error) {
    return toErrorResponse(error);
  }
}
