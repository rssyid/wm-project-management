import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { prisma } from "@/infra/db";
import { DomainError } from "@/shared/errors";
import { createProgressLog, listProgressLogs } from "@/domain/physical/service";
import { createProgressLogSchema } from "@/shared/schemas/physical";

type Context = { params: Promise<{ id: string }> };

async function physicalProcessIdForWorkItem(id: string) {
  const workItem = await prisma.workItem.findUnique({
    where: { id },
    select: {
      physicalProcess: { select: { id: true } },
    },
  });
  if (!workItem || !workItem.physicalProcess) {
    throw new DomainError("NOT_FOUND", "Proses fisik tidak ditemukan.");
  }
  return workItem.physicalProcess.id;
}

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;
    const physicalProcessId = await physicalProcessIdForWorkItem(id);
    const logs = await listProgressLogs(physicalProcessId);
    return ok({ logs });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const physicalProcessId = await physicalProcessIdForWorkItem(id);
    const input = await parseJson(request, createProgressLogSchema);
    return ok(await createProgressLog(physicalProcessId, input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
