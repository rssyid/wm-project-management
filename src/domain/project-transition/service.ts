import { writeAudit } from "@/domain/audit/service";
import {
  hasEdge,
  isCancellable,
  isHoldable,
} from "@/domain/project-transition/gates";
import type { Tx } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import {
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/shared/project-status";

const projectSelect = {
  id: true,
  status: true,
  previousStatus: true,
  deletedAt: true,
  picUserId: true,
  targetStartDate: true,
  targetEndDate: true,
  plannedBudget: true,
} as const;

export type ProjectState = Awaited<ReturnType<typeof findProjectState>> | null;

async function findProjectState(tx: Tx, projectId: string) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: projectSelect,
  });
  if (!project) return null;
  const estateCount = await tx.projectEstate.count({ where: { projectId } });
  return { ...project, estateCount };
}

function invalidTransition(
  from: ProjectStatus,
  to: ProjectStatus,
): DomainError {
  return new DomainError(
    "INVALID_TRANSITION",
    `Status proyek "${PROJECT_STATUS_LABEL[from]}" tidak bisa menjadi "${PROJECT_STATUS_LABEL[to]}".`,
  );
}

/**
 * AC-15: satu-satunya jalan untuk mengubah `Project.status`. Proyek terkunci (COMPLETED,
 * CANCELLED, ter-soft delete) menolak semua mutasi dengan `PROJECT_LOCKED`.
 */
export async function requireMutableProject(
  tx: Tx,
  projectId: string,
): Promise<NonNullable<ProjectState>> {
  const project = await findProjectState(tx, projectId);
  if (!project || project.deletedAt) {
    throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
  }
  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    throw new DomainError(
      "PROJECT_LOCKED",
      `Proyek sudah ${PROJECT_STATUS_LABEL[project.status]} sehingga isinya tidak bisa diubah.`,
    );
  }
  return project;
}

/**
 * WAITING_BAST mengunci input lapangan (kiriman, koreksi, log, revisi); pembayaran tetap
 * boleh karena tidak lewat fungsi ini (docs/01 §5).
 */
export function assertFieldInputAllowed(project: {
  status: ProjectStatus;
}): void {
  if (project.status === "WAITING_BAST") {
    throw new DomainError(
      "FIELD_INPUT_LOCKED",
      "Proyek menunggu BAST sehingga input lapangan dikunci.",
    );
  }
}

/** CHECK project_previous_status: previousStatus terisi tepat ketika status ON_HOLD. */
function statusData(
  from: ProjectStatus,
  to: ProjectStatus,
  reason: string | null,
): {
  status: ProjectStatus;
  previousStatus?: ProjectStatus | null;
  onHoldReason?: string | null;
} {
  if (to === "ON_HOLD") {
    return { status: to, previousStatus: from, onHoldReason: reason };
  }
  if (from === "ON_HOLD") {
    return { status: to, previousStatus: null, onHoldReason: null };
  }
  return { status: to };
}

export type TransitionInput = {
  projectId: string;
  from: ProjectStatus;
  to: ProjectStatus;
  actorId: string | null;
  reason?: string | null;
};

async function recordStatusChange(
  tx: Tx,
  input: TransitionInput,
  reason: string | null,
): Promise<void> {
  await tx.projectStatusHistory.create({
    data: {
      projectId: input.projectId,
      fromStatus: input.from,
      toStatus: input.to,
      reason,
      actorId: input.actorId,
    },
  });
  await writeAudit(tx, {
    actorId: input.actorId,
    projectId: input.projectId,
    entityType: "Project",
    entityId: input.projectId,
    action: "TRANSITION",
    before: { status: input.from },
    after: { status: input.to },
    reason,
  });
}

/**
 * Transisi manual: status saat ini harus persis `from`, kalau tidak 409 `INVALID_TRANSITION`
 * supaya aksi tidak diam-diam berlaku pada proyek yang sudah bergerak.
 */
export async function transitionProject(
  tx: Tx,
  input: TransitionInput,
): Promise<void> {
  if (!hasEdge(input.from, input.to)) {
    throw invalidTransition(input.from, input.to);
  }
  const reason = input.reason ?? null;
  const result = await tx.project.updateMany({
    where: { id: input.projectId, status: input.from },
    data: {
      ...statusData(input.from, input.to, reason),
      version: { increment: 1 },
    },
  });
  if (result.count === 0) throw invalidTransition(input.from, input.to);
  await recordStatusChange(tx, input, reason);
}

/**
 * Transisi otomatis memakai update bersyarat yang sama tetapi diam-diam bila proyek sudah
 * maju, sehingga pemicu seperti kiriman pertama hanya berefek sekali (docs/02 §4).
 */
export async function autoTransitionProject(
  tx: Tx,
  input: TransitionInput,
): Promise<boolean> {
  if (!hasEdge(input.from, input.to)) {
    throw invalidTransition(input.from, input.to);
  }
  const reason = input.reason ?? null;
  const result = await tx.project.updateMany({
    where: { id: input.projectId, status: input.from },
    data: {
      ...statusData(input.from, input.to, reason),
      version: { increment: 1 },
    },
  });
  if (result.count === 0) return false;
  await recordStatusChange(tx, input, reason);
  return true;
}

/** Gate DRAFT → SURVEY (docs/01 §5): lokasi, kategori, PIC, target, dan anggaran rencana. */
export async function startSurvey(
  tx: Tx,
  projectId: string,
  actorId: string,
): Promise<void> {
  const project = await requireMutableProject(tx, projectId);
  if (project.status !== "DRAFT") {
    throw invalidTransition(project.status, "SURVEY");
  }
  const missing: string[] = [];
  if (project.estateCount === 0) missing.push("lokasi Estate");
  if (!project.picUserId) missing.push("PIC");
  if (!project.targetStartDate || !project.targetEndDate) {
    missing.push("target mulai dan selesai");
  }
  if (!project.plannedBudget) missing.push("anggaran rencana");
  if (missing.length > 0) {
    throw new DomainError(
      "PRECONDITION_FAILED",
      `Lengkapi ${missing.join(", ")} sebelum memulai survei.`,
    );
  }
  await transitionProject(tx, {
    projectId,
    from: "DRAFT",
    to: "SURVEY",
    actorId,
  });
}

/** Tahan proyek; status sebelumnya disimpan supaya Lanjutkan bisa mengembalikannya. */
export async function holdProject(
  tx: Tx,
  projectId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!project || project.deletedAt) {
    throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
  }
  if (!isHoldable(project.status)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Proyek dengan status "${PROJECT_STATUS_LABEL[project.status]}" tidak bisa ditahan.`,
    );
  }
  await transitionProject(tx, {
    projectId,
    from: project.status,
    to: "ON_HOLD",
    actorId,
    reason,
  });
}

export async function resumeProject(
  tx: Tx,
  projectId: string,
  actorId: string,
): Promise<ProjectStatus> {
  const project = await requireMutableProject(tx, projectId);
  if (project.status !== "ON_HOLD" || !project.previousStatus) {
    throw new DomainError("INVALID_TRANSITION", "Proyek tidak sedang ditahan.");
  }
  await transitionProject(tx, {
    projectId,
    from: "ON_HOLD",
    to: project.previousStatus,
    actorId,
  });
  return project.previousStatus;
}

/** Batal proyek hanya dari status non-terminal; riwayat tetap terbaca (docs/01 §12). */
export async function cancelProject(
  tx: Tx,
  projectId: string,
  reason: string,
  actorId: string,
  cancelledAt: Date,
): Promise<void> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!project || project.deletedAt) {
    throw new DomainError("NOT_FOUND", "Proyek tidak ditemukan.");
  }
  if (!isCancellable(project.status)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Proyek sudah ${PROJECT_STATUS_LABEL[project.status]} sehingga tidak bisa dibatalkan.`,
    );
  }
  const result = await tx.project.updateMany({
    where: { id: projectId, status: project.status },
    data: {
      status: "CANCELLED",
      previousStatus: null,
      onHoldReason: null,
      cancelledAt,
      cancelledById: actorId,
      cancelReason: reason,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) throw invalidTransition(project.status, "CANCELLED");
  await recordStatusChange(
    tx,
    { projectId, from: project.status, to: "CANCELLED", actorId, reason },
    reason,
  );
}
