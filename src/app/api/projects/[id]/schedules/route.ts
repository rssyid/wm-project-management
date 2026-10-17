import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { prisma } from "@/infra/db";
import { DomainError } from "@/shared/errors";

type Context = { params: Promise<{ id: string }> };

type ScheduleRow = {
  processType: string;
  referenceId: string;
  referenceName?: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  lockedAt: Date | null;
  revisionNo: number | null;
  revisionStart: Date | null;
  revisionEnd: Date | null;
  revisionReason: string | null;
};

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { id } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!project) {
      throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
    }

    // Kumpulkan semua baseline yang terkait project melalui tender attempt,
    // proses fisik, dan paket kerja.
    const workItems = await prisma.workItem.findMany({
      where: { projectId: id },
      select: { id: true, name: true },
    });
    const workItemIds = workItems.map((w) => w.id);

    const tenderAttempts = await prisma.tenderAttempt.findMany({
      where: { workItemId: { in: workItemIds } },
      select: { id: true, workItemId: true },
    });
    const attemptIds = tenderAttempts.map((a) => a.id);

    const physicalProcesses = await prisma.physicalProcess.findMany({
      where: { workItemId: { in: workItemIds } },
      select: { id: true, workItemId: true },
    });
    const processIds = physicalProcesses.map((p) => p.id);

    const workPackages = await prisma.workPackage.findMany({
      where: { projectId: id },
      select: { id: true, name: true },
    });

    const baselines = await prisma.scheduleBaseline.findMany({
      where: {
        OR: [
          { tenderAttemptId: { in: attemptIds } },
          { physicalProcessId: { in: processIds } },
          { workPackageId: { in: workPackages.map((p) => p.id) } },
        ],
      },
      include: {
        revisions: { orderBy: { revisionNo: "asc" } },
        tenderAttempt: { select: { workItemId: true } },
        physicalProcess: { select: { workItemId: true } },
        workPackage: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const workItemById = Object.fromEntries(
      workItems.map((w) => [w.id, w.name]),
    );
    const attemptToWorkItem = Object.fromEntries(
      tenderAttempts.map((a) => [a.id, a.workItemId]),
    );
    const processToWorkItem = Object.fromEntries(
      physicalProcesses.map((p) => [p.id, p.workItemId]),
    );
    const packageById = Object.fromEntries(
      workPackages.map((p) => [p.id, p.name]),
    );

    const rows: ScheduleRow[] = baselines.map((b) => {
      let processType = "";
      let referenceId = "";
      let referenceName: string | null = null;
      if (b.tenderAttemptId) {
        processType = "TENDER_ATTEMPT";
        referenceId = b.tenderAttemptId;
        const wiId = attemptToWorkItem[b.tenderAttemptId];
        referenceName = wiId ? workItemById[wiId] ?? null : null;
      } else if (b.physicalProcessId) {
        processType = "PHYSICAL";
        referenceId = b.physicalProcessId;
        const wiId = processToWorkItem[b.physicalProcessId];
        referenceName = wiId ? workItemById[wiId] ?? null : null;
      } else if (b.workPackageId) {
        processType = "WORK_PACKAGE";
        referenceId = b.workPackageId;
        referenceName = packageById[b.workPackageId] ?? null;
      }
      const lastRev = b.revisions[b.revisions.length - 1];
      return {
        processType,
        referenceId,
        referenceName,
        plannedStart: b.plannedStart,
        plannedEnd: b.plannedEnd,
        lockedAt: b.lockedAt,
        revisionNo: lastRev ? lastRev.revisionNo : null,
        revisionStart: lastRev ? lastRev.plannedStart : null,
        revisionEnd: lastRev ? lastRev.plannedEnd : null,
        revisionReason: lastRev ? lastRev.reason : null,
      };
    });

    return ok({ rows, projectStatus: project.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
