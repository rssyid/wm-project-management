import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import {
  GET as listAttemptsRoute,
  POST as createAttemptRoute,
} from "@/app/api/projects/[id]/afce-attempts/route";
import {
  GET as getAttemptRoute,
  PATCH as updateAttemptRoute,
} from "@/app/api/afce-attempts/[id]/route";
import { PUT as boqRoute } from "@/app/api/afce-attempts/[id]/boq/route";
import { PUT as levelsRoute } from "@/app/api/afce-attempts/[id]/levels/route";
import { POST as submitRoute } from "@/app/api/afce-attempts/[id]/submit/route";
import { PATCH as patchProjectRoute } from "@/app/api/projects/[id]/route";

type Envelope = {
  data?: unknown;
  error?: { code: string; message: string };
  fields?: Record<string, string>;
};

async function signIn(email: string, password: string): Promise<string> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
}

describe("API AFCE", () => {
  let cookieSpecialist: string;
  let cookieViewer: string;
  let userId: string;
  let tierRendahId: string;
  let tierTinggiId: string;
  let positionIds: string[];
  let positionTinggiIds: string[];

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    cookieViewer = await signIn(viewer.email, viewer.password);
    userId = specialist.id;

    positionIds = (
      await prisma.approvalPosition.findMany({
        orderBy: { rank: "asc" },
        select: { id: true },
      })
    ).map((position) => position.id);
    positionTinggiIds = positionIds.slice(2, 4);

    tierRendahId = (
      await prisma.approvalMatrixTier.create({
        data: {
          name: "Tier rendah",
          forAfce: true,
          forArSupplement: true,
          minAmount: "0",
          maxAmount: "500000000",
          levels: {
            create: [
              { levelNo: 1, positionId: positionIds[0]! },
              { levelNo: 2, positionId: positionIds[1]! },
            ],
          },
        },
        select: { id: true },
      })
    ).id;
    tierTinggiId = (
      await prisma.approvalMatrixTier.create({
        data: {
          name: "Tier tinggi",
          forAfce: true,
          forArSupplement: true,
          minAmount: "500000000",
          levels: {
            create: [
              { levelNo: 1, positionId: positionTinggiIds[0]! },
              { levelNo: 2, positionId: positionTinggiIds[1]! },
            ],
          },
        },
        select: { id: true },
      })
    ).id;
  });

  async function projectAt(status: ProjectStatus) {
    const { project } = await createProject({
      createdById: userId,
      picUserId: userId,
      targetStartDate: new Date(Date.UTC(2026, 9, 1)),
      targetEndDate: new Date(Date.UTC(2026, 10, 30)),
      plannedBudget: "450000000.00",
      status,
    });
    return project.id;
  }

  async function createAttempt(
    projectId: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await callRoute(createAttemptRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: projectId },
      body,
    });
    return { response, json: await readJson<Envelope>(response) };
  }

  it("AC-17 nilai AFCE sama dengan total BOQ", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };

    const response = await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [
          { activityName: "Galian saluran", amount: "120000000.00" },
          { activityName: "Pasangan dinding", amount: "80000000.50" },
        ],
      },
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toMatchObject({
      basisAmount: "200000000.50",
    });
  });

  it("AC-17 level disalin dari tier sesuai nilai BOQ", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };

    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "450000000.00" }],
      },
    });

    const detail = await readJson<{
      data: {
        basisAmount: string;
        matrixTier: { id: string };
        levels: unknown[];
      };
    }>(
      await callRoute(getAttemptRoute, {
        cookie: cookieViewer,
        params: { id: attempt.id },
      }),
    );
    expect(detail.data.basisAmount).toBe("450000000.00");
    expect(detail.data.matrixTier.id).toBe(tierRendahId);
    expect(detail.data.levels).toHaveLength(2);
  });

  it("AC-19 level bisa diubah saat DRAFT dan ditandai berbeda dari matriks", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };
    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "450000000.00" }],
      },
    });

    const response = await callRoute(levelsRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: { version: 2, positionIds: [positionIds[0], positionTinggiIds[0]] },
    });
    expect(response.status).toBe(200);

    const detail = await readJson<{
      data: {
        levels: { positionId: string; differsFromMatrix: boolean }[];
      };
    }>(
      await callRoute(getAttemptRoute, {
        cookie: cookieViewer,
        params: { id: attempt.id },
      }),
    );
    expect(detail.data.levels.map((level) => level.positionId)).toEqual([
      positionIds[0],
      positionTinggiIds[0],
    ]);
    expect(detail.data.levels.every((level) => level.differsFromMatrix)).toBe(
      true,
    );

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "AfceAttempt", reason: "Level approval" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.length).toBeGreaterThan(0);
  });

  it("AC-19 level manual tidak ditimpa saat tier berubah karena BOQ (D-53)", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };
    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "450000000.00" }],
      },
    });
    await callRoute(levelsRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: { version: 2, positionIds: [positionIds[0], positionTinggiIds[0]] },
    });

    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 3,
        items: [{ activityName: "Galian", amount: "800000000.00" }],
      },
    });

    const snapshots = await prisma.approvalLevelSnapshot.findMany({
      where: { afceAttemptId: attempt.id },
      orderBy: { levelNo: "asc" },
      select: { positionId: true },
    });
    expect(snapshots.map((row) => row.positionId)).toEqual([
      positionIds[0],
      positionTinggiIds[0],
    ]);
    const attemptRow = await prisma.afceAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      select: { matrixTierId: true },
    });
    expect(attemptRow.matrixTierId).toBe(tierTinggiId);
  });

  it("AC-20 pengajuan tanpa tanggal pengajuan atau tanggal email ditolak 400", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };
    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "450000000.00" }],
      },
    });

    const response = await callRoute(submitRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: attempt.id },
      body: { version: 2, submittedDate: "2026-10-20" },
    });
    expect(response.status).toBe(400);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("AC-20 pengajuan memindahkan proyek ke Menunggu AFCE/AR", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };
    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "450000000.00" }],
      },
    });

    const response = await callRoute(submitRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: attempt.id },
      body: {
        version: 2,
        submittedDate: "2026-10-20",
        approvalEmailDate: "2026-10-18",
      },
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toMatchObject({
      projectStatus: "WAITING_AFCE_AR",
    });

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project.status).toBe("WAITING_AFCE_AR");
  });

  it("AC-17 attempt yang sudah diajukan terkunci", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };
    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "450000000.00" }],
      },
    });
    await callRoute(submitRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: attempt.id },
      body: {
        version: 2,
        submittedDate: "2026-10-20",
        approvalEmailDate: "2026-10-18",
      },
    });

    const response = await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 3,
        items: [{ activityName: "Galian", amount: "10.00" }],
      },
    });
    expect(response.status).toBe(409);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "PRECONDITION_FAILED",
    );
  });

  it("AC-18 nilai tanpa tier cocok ditolak saat pengajuan", async () => {
    const projectId = await projectAt("RAB_READY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };
    await prisma.approvalMatrixTier.updateMany({
      where: { id: tierTinggiId },
      data: { isActive: false },
    });
    await callRoute(boqRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: attempt.id },
      body: {
        version: 1,
        items: [{ activityName: "Galian", amount: "800000000.00" }],
      },
    });

    const response = await callRoute(submitRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: attempt.id },
      body: {
        version: 2,
        submittedDate: "2026-10-20",
        approvalEmailDate: "2026-10-18",
      },
    });
    await prisma.approvalMatrixTier.update({
      where: { id: tierTinggiId },
      data: { isActive: true },
    });
    expect(response.status).toBe(409);
    expect((await readJson<Envelope>(response)).error?.message).toContain(
      "800000000.00",
    );
  });

  it("AC-16 menandai RAB siap memindahkan proyek dari Survei ke RAB siap", async () => {
    const projectId = await projectAt("SURVEY");
    const attempt = (await createAttempt(projectId)).json.data as {
      id: string;
    };

    const response = await callRoute(updateAttemptRoute, {
      cookie: cookieSpecialist,
      method: "PATCH",
      params: { id: attempt.id },
      body: { version: 1, afceNumber: "AFCE/2026/001", rabReady: true },
    });
    expect(response.status).toBe(200);

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project.status).toBe("RAB_READY");
  });

  it("hanya satu attempt AFCE aktif per proyek", async () => {
    const projectId = await projectAt("RAB_READY");
    const first = await createAttempt(projectId);
    expect(first.response.status).toBe(200);

    const second = await createAttempt(projectId);
    expect(second.response.status).toBe(409);
    expect(second.json.error?.code).toBe("ACTIVE_CONFLICT");
  });

  it("AC-02 viewer tidak boleh membuat attempt", async () => {
    const projectId = await projectAt("RAB_READY");
    const response = await callRoute(createAttemptRoute, {
      cookie: cookieViewer,
      method: "POST",
      params: { id: projectId },
      body: {},
    });
    expect(response.status).toBe(403);
  });

  it("daftar attempt menampilkan attempt lama beserta statusnya", async () => {
    const projectId = await projectAt("RAB_READY");
    await createAttempt(projectId);

    const response = await callRoute(listAttemptsRoute, {
      cookie: cookieViewer,
      params: { id: projectId },
    });
    const body = await readJson<{
      data: { status: string; basisAmount: string }[];
    }>(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.status).toBe("DRAFT");
    expect(body.data[0]?.basisAmount).toBe("0.00");
  });

  it("mengubah proyek yang sudah RAB_READY tetap menjaga status proyek", async () => {
    const projectId = await projectAt("RAB_READY");
    const response = await callRoute(patchProjectRoute, {
      cookie: cookieSpecialist,
      method: "PATCH",
      params: { id: projectId },
      body: { version: 1, name: "Nama diperbarui" },
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toMatchObject({
      version: 2,
    });
  });
});
