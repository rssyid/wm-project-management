import { beforeAll, describe, expect, it } from "vitest";

import {
  assertFieldInputAllowed,
  autoTransitionProject,
  cancelProject,
  holdProject,
  requireMutableProject,
  resumeProject,
  startSurvey,
  transitionProject,
} from "@/domain/project-transition/service";
import { withTransaction } from "@/infra/tx";
import { isDomainError } from "@/shared/errors";

import { createProject, createUser, ensureSeed } from "./helpers/factory";
import { prisma } from "@/infra/db";

const TARGET_START = new Date(Date.UTC(2026, 9, 1));
const TARGET_END = new Date(Date.UTC(2026, 10, 30));

async function domainError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (isDomainError(error)) return error.code;
    throw error;
  }
  throw new Error("Fungsi seharusnya melempar DomainError.");
}

describe("project-transition", () => {
  let actorId: string;

  beforeAll(async () => {
    await ensureSeed();
    actorId = (await createUser({ role: "WM_HO_SPECIALIST" })).id;
  });

  async function draftProject(
    overrides: Partial<
      Omit<Parameters<typeof createProject>[0], "createdById">
    >,
  ) {
    const { project } = await createProject({
      createdById: actorId,
      picUserId: actorId,
      targetStartDate: TARGET_START,
      targetEndDate: TARGET_END,
      plannedBudget: "500000000.00",
      ...overrides,
    });
    return project;
  }

  it("AC-15 setiap perubahan status tercatat di riwayat status", async () => {
    const project = await draftProject({});

    await withTransaction((tx) => startSurvey(tx, project.id, actorId));

    const history = await prisma.projectStatusHistory.findMany({
      where: { projectId: project.id },
      orderBy: { at: "asc" },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: "DRAFT",
      toStatus: "SURVEY",
      actorId,
    });

    const refreshed = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(refreshed.status).toBe("SURVEY");
    expect(refreshed.version).toBe(2);
  });

  it("AC-15 perubahan status juga menulis satu AuditLog", async () => {
    const project = await draftProject({});

    await withTransaction((tx) => startSurvey(tx, project.id, actorId));

    const logs = await prisma.auditLog.findMany({
      where: { projectId: project.id, entityType: "Project" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId,
      action: "TRANSITION",
      before: { status: "DRAFT" },
      after: { status: "SURVEY" },
    });
  });

  it("AC-06 edge yang tidak ada di dokumen domain ditolak INVALID_TRANSITION", async () => {
    const project = await draftProject({});

    const code = await domainError(
      withTransaction((tx) =>
        transitionProject(tx, {
          projectId: project.id,
          from: "DRAFT",
          to: "PROCUREMENT",
          actorId,
        }),
      ),
    );
    expect(code).toBe("INVALID_TRANSITION");
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
        .status,
    ).toBe("DRAFT");
  });

  it("menolak transisi bila status proyek sudah bergerak", async () => {
    const project = await draftProject({});
    await withTransaction((tx) => startSurvey(tx, project.id, actorId));

    const code = await domainError(
      withTransaction((tx) =>
        transitionProject(tx, {
          projectId: project.id,
          from: "DRAFT",
          to: "SURVEY",
          actorId,
        }),
      ),
    );
    expect(code).toBe("INVALID_TRANSITION");
  });

  it("AC-12 Mulai Survei menolak proyek tanpa data dasar lengkap", async () => {
    const project = await draftProject({
      picUserId: null,
      plannedBudget: undefined,
    });

    const code = await domainError(
      withTransaction((tx) => startSurvey(tx, project.id, actorId)),
    );
    expect(code).toBe("PRECONDITION_FAILED");
  });

  it("AC-16 RAB_READY hanya lewat transisi otomatis dan hanya berefek sekali", async () => {
    const project = await draftProject({ status: "SURVEY" });

    const results = await withTransaction(async (tx) => {
      const first = await autoTransitionProject(tx, {
        projectId: project.id,
        from: "SURVEY",
        to: "RAB_READY",
        actorId: null,
        reason: "RAB ditandai siap",
      });
      const second = await autoTransitionProject(tx, {
        projectId: project.id,
        from: "SURVEY",
        to: "RAB_READY",
        actorId: null,
      });
      return [first, second];
    });

    expect(results).toEqual([true, false]);
    const history = await prisma.projectStatusHistory.findMany({
      where: { projectId: project.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.actorId).toBeNull();
  });

  it("AC-67 tahan menyimpan status sebelumnya dan lanjutkan mengembalikannya", async () => {
    const project = await draftProject({ status: "SURVEY" });

    await withTransaction((tx) =>
      holdProject(tx, project.id, "Musim hujan", actorId),
    );
    const held = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(held).toMatchObject({
      status: "ON_HOLD",
      previousStatus: "SURVEY",
      onHoldReason: "Musim hujan",
    });

    await withTransaction((tx) => resumeProject(tx, project.id, actorId));
    const resumed = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(resumed).toMatchObject({ status: "SURVEY", previousStatus: null });
    expect(resumed.onHoldReason).toBeNull();
  });

  it("AC-67 proyek DRAFT tidak bisa ditahan", async () => {
    const project = await draftProject({});
    const code = await domainError(
      withTransaction((tx) => holdProject(tx, project.id, "Alasan", actorId)),
    );
    expect(code).toBe("INVALID_TRANSITION");
  });

  it("AC-68 batal proyek menyimpan alasan dan mengunci semua mutasi berikutnya", async () => {
    const project = await draftProject({});

    await withTransaction((tx) =>
      cancelProject(
        tx,
        project.id,
        "Proyek dibatalkan karena dana tidak tersedia",
        actorId,
        new Date(Date.UTC(2026, 9, 20)),
      ),
    );

    const cancelled = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(cancelled).toMatchObject({
      status: "CANCELLED",
      cancelReason: "Proyek dibatalkan karena dana tidak tersedia",
      cancelledById: actorId,
    });

    const code = await domainError(
      withTransaction((tx) => requireMutableProject(tx, project.id)),
    );
    expect(code).toBe("PROJECT_LOCKED");
  });

  it("AC-64 proyek WAITING_BAST menolak input lapangan", async () => {
    const project = await draftProject({ status: "WAITING_BAST" });
    const loaded = await withTransaction((tx) =>
      requireMutableProject(tx, project.id),
    );

    const code = await domainError(
      Promise.resolve().then(() => assertFieldInputAllowed(loaded)),
    );
    expect(code).toBe("FIELD_INPUT_LOCKED");
  });

  it("proyek ter-soft delete dibaca sebagai tidak ditemukan", async () => {
    const project = await draftProject({});
    await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date() },
    });

    const code = await domainError(
      withTransaction((tx) => requireMutableProject(tx, project.id)),
    );
    expect(code).toBe("NOT_FOUND");
  });
});
