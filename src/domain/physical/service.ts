// docs/01 §8, §11; docs/04 §6: mulai proses fisik dan log progres mingguan.
// Setiap mutasi dalam transaksi dengan AuditLog.
import { writeAudit, assertUpdated } from "@/domain/audit/service";
import {
  requireMutableProject,
  assertFieldInputAllowed,
  autoTransitionProject,
} from "@/domain/project-transition/service";
import { withTransaction } from "@/infra/tx";
import { decimal } from "@/infra/decimal";
import { DomainError } from "@/shared/errors";

export type StartPhysicalInput = {
  startedDate?: string | null;
};

export type CreateProgressLogInput = {
  weekStart: string;
  cumulativePct: string;
  volume?: string | null;
  notes?: string | null;
  decreaseReason?: string | null;
  equipment?: readonly {
    heavyEquipmentTypeId: string;
    unitCount: string;
    workingHours: string;
    vendorId?: string | null;
    notes?: string | null;
  }[];
  photoFileIds?: readonly string[];
};

export type SupersedeProgressLogInput = {
  weekStart: string;
  reason: string;
};

function isMonday(iso: string): boolean {
  const parts = iso.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  return d.getUTCDay() === 1;
}

/** Mulai proses fisik Pekerjaan; wajib ≥ 1 SPK RELEASED aktif. */
export async function startPhysical(
  workItemId: string,
  input: StartPhysicalInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const process = await tx.physicalProcess.findUnique({
      where: { workItemId },
      include: {
        workItem: { select: { projectId: true, name: true } },
      },
    });
    if (!process) {
      throw new DomainError("NOT_FOUND", "Proses fisik tidak ditemukan.");
    }
    const { projectId } = process.workItem;

    const releasedSpk = await tx.spk.count({
      where: { workItemId, status: "RELEASED", cancelledDate: null },
    });
    if (releasedSpk === 0) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Minimal satu SPK RELEASED aktif wajib ada sebelum memulai pekerjaan fisik.",
      );
    }

    const updated = await tx.physicalProcess.updateMany({
      where: {
        id: process.id,
        status: { in: ["BELUM_MULAI", "JEDA_SPK_BATAL"] },
      },
      data: {
        status: "BERJALAN",
        actualStart: input.startedDate ? new Date(input.startedDate) : null,
        version: { increment: 1 },
      },
    });
    assertUpdated(updated.count);

    // Otomatis PROCUREMENT → EXECUTION saat mulai fisik pertama kali (docs/01 §5).
    const project = await requireMutableProject(tx, projectId);
    if (project.status === "PROCUREMENT") {
      await autoTransitionProject(tx, {
        projectId,
        from: "PROCUREMENT",
        to: "EXECUTION",
        actorId,
      });
    }

    const after = await tx.physicalProcess.findUniqueOrThrow({
      where: { id: process.id },
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "PhysicalProcess",
      entityId: process.id,
      action: "UPDATE",
      before: { status: process.status },
      after: { status: after.status, actualStart: after.actualStart },
      reason: "Mulai pekerjaan fisik",
    });

    return after;
  });
}

/** Daftar semua log progres (termasuk yang digantikan). */
export async function listProgressLogs(physicalProcessId: string) {
  return withTransaction(async (tx) => {
    return tx.progressLog.findMany({
      where: { physicalProcessId },
      orderBy: { weekStart: "asc" },
      include: { equipmentUsage: true },
    });
  });
}

/** Catat log progres mingguan. Satu log aktif per minggu; 100% → SELESAI. */
export async function createProgressLog(
  physicalProcessId: string,
  input: CreateProgressLogInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    if (!isMonday(input.weekStart)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "weekStart harus berupa hari Senin.",
      );
    }

    const process = await tx.physicalProcess.findUnique({
      where: { id: physicalProcessId },
      include: {
        workItem: { select: { projectId: true } },
        progressLogs: {
          where: { supersededById: null },
          orderBy: { weekStart: "desc" },
        },
      },
    });
    if (!process) {
      throw new DomainError("NOT_FOUND", "Proses fisik tidak ditemukan.");
    }
    const { projectId } = process.workItem;

    const project = await requireMutableProject(tx, projectId);
    assertFieldInputAllowed(project);

    const latest = process.progressLogs[0];
    const newPct = decimal(input.cumulativePct);
    if (latest && newPct.lessThan(latest.cumulativePct) && !input.decreaseReason) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Persen turun wajib disertai alasan.",
      );
    }

    // Catat log baru; log aktif minggu yang sama ditandai digantikan setelahnya.
    // Unique index DB (satu log aktif per minggu) ditangguhkan sampai commit transaksi
    // lewat SET CONSTRAINTS di awal transaksi (lihat migration).
    const created = await tx.progressLog.create({
      data: {
        physicalProcessId,
        weekStart: new Date(input.weekStart),
        cumulativePct: decimal(input.cumulativePct),
        volume: input.volume ? decimal(input.volume) : null,
        notes: input.notes ?? null,
        decreaseReason: input.decreaseReason ?? null,
        recordedById: actorId,
      },
    });

    // Tandai log aktif minggu yang sama sebagai digantikan oleh log baru (jika ada).
    const sameWeek = process.progressLogs.find(
      (log) =>
        log.supersededById === null &&
        new Date(log.weekStart).toISOString().slice(0, 10) === input.weekStart,
    );
    if (sameWeek) {
      await tx.progressLog.update({
        where: { id: sameWeek.id },
        data: { supersededById: created.id },
      });
    }

    // Selesaikan proses fisik saat 100% (docs/01 §8).
    if (newPct.equals(decimal("100"))) {
      await tx.physicalProcess.updateMany({
        where: { id: physicalProcessId, status: "BERJALAN" },
        data: { status: "SELESAI", actualEnd: new Date(input.weekStart) },
      });
    }

    // Alat berat tidak memengaruhi progres (docs/01 §8, AC-48).
    for (const e of input.equipment ?? []) {
      await tx.heavyEquipmentUsage.create({
        data: {
          progressLogId: created.id,
          heavyEquipmentTypeId: e.heavyEquipmentTypeId,
          unitCount: Number(e.unitCount),
          workingHours: decimal(e.workingHours),
          vendorId: e.vendorId ?? null,
          notes: e.notes ?? null,
        },
      });
    }

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "ProgressLog",
      entityId: created.id,
      action: "CREATE",
      after: {
        weekStart: input.weekStart,
        cumulativePct: input.cumulativePct,
        volume: input.volume,
        decreaseReason: input.decreaseReason,
      },
      reason: input.decreaseReason ?? "Catat log progres mingguan",
    });

    return created;
  });
}

/** Log pengganti minggu yang sama; log lama tetap, ditandai digantikan. */
export async function supersedeProgressLog(
  logId: string,
  input: SupersedeProgressLogInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    if (!isMonday(input.weekStart)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "weekStart harus berupa hari Senin.",
      );
    }

    const log = await tx.progressLog.findUnique({
      where: { id: logId },
      include: {
        physicalProcess: {
          select: {
            id: true,
            workItem: { select: { projectId: true } },
            progressLogs: {
              where: { supersededById: null },
              orderBy: { weekStart: "desc" },
            },
          },
        },
      },
    });
    if (!log) {
      throw new DomainError("NOT_FOUND", "Log progres tidak ditemukan.");
    }
    const { projectId } = log.physicalProcess.workItem;

    const project = await requireMutableProject(tx, projectId);
    assertFieldInputAllowed(project);

    // Hanya boleh menggantikan log aktif minggu yang sama.
    const sameWeekActive = log.physicalProcess.progressLogs.find(
      (l) =>
        l.supersededById === null &&
        new Date(l.weekStart).toISOString().slice(0, 10) === input.weekStart,
    );
    if (!sameWeekActive || sameWeekActive.id !== logId) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Hanya log aktif minggu yang sama yang bisa digantikan.",
      );
    }

    const created = await tx.progressLog.create({
      data: {
        physicalProcessId: log.physicalProcessId,
        weekStart: new Date(input.weekStart),
        cumulativePct: log.cumulativePct,
        volume: log.volume,
        notes: log.notes ?? null,
        decreaseReason: log.decreaseReason,
        recordedById: actorId,
        supersededById: null,
      },
    });

    await tx.progressLog.update({
      where: { id: logId },
      data: { supersededById: created.id },
    });

    await writeAudit(tx, {
      actorId,
      projectId,
      entityType: "ProgressLog",
      entityId: created.id,
      action: "CREATE",
      after: {
        weekStart: input.weekStart,
        cumulativePct: log.cumulativePct.toString(),
        reason: input.reason,
      },
      before: {
        id: logId,
        cumulativePct: log.cumulativePct.toString(),
      },
      reason: input.reason,
    });

    return { id: created.id, supersedes: logId };
  });
}
