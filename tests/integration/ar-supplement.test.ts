import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as decisionRoute } from "@/app/api/approval-levels/[levelId]/decision/route";
import { GET as budgetRoute } from "@/app/api/projects/[id]/budget/route";
import {
  GET as listRoute,
  POST as createRoute,
} from "@/app/api/projects/[id]/ar-supplements/route";
import { POST as submitRoute } from "@/app/api/ar-supplements/[id]/submit/route";

type Envelope = { data?: unknown; error?: { code: string; message: string } };

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

describe("AR tambahan", () => {
  let cookie: string;
  let viewerCookie: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    cookie = await signIn(specialist.email, specialist.password);
    viewerCookie = await signIn(viewer.email, viewer.password);
    userId = specialist.id;

    const positions = await prisma.approvalPosition.findMany({
      orderBy: { rank: "asc" },
      take: 2,
      select: { id: true },
    });
    await prisma.approvalMatrixTier.create({
      data: {
        name: "Tier AR tambahan",
        forAfce: false,
        forArSupplement: true,
        minAmount: "0",
        levels: {
          create: [
            { levelNo: 1, positionId: positions[0]!.id },
            { levelNo: 2, positionId: positions[1]!.id },
          ],
        },
      },
    });
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

  async function createSupplement(
    projectId: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await callRoute(createRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: {
        number: "AR/2026/001",
        amount: "75000000.00",
        reason: "Penambahan pekerjaan chilled water",
        date: "2026-11-05",
        ...body,
      },
    });
    return { response, json: await readJson<Envelope>(response) };
  }

  it("AR tambahan menyimpan nominal, alasan, dan tanggal lalu menyalin level dari tier", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const { response, json } = await createSupplement(projectId);
    expect(response.status).toBe(200);

    const list = await readJson<{
      data: {
        id: string;
        amount: string;
        reason: string;
        date: string;
        status: string;
        levels: { levelNo: number }[];
      }[];
    }>(
      await callRoute(listRoute, {
        cookie: viewerCookie,
        params: { id: projectId },
      }),
    );
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      amount: "75000000.00",
      reason: "Penambahan pekerjaan chilled water",
      date: "2026-11-05",
      status: "DRAFT",
    });
    expect(list.data[0]?.levels).toHaveLength(2);
    expect(json.data).toHaveProperty("id");
  });

  it("AC-25 AR tambahan Approved menambah anggaran tanpa mengubah status proyek", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    await prisma.budgetEntry.create({
      data: {
        projectId,
        type: "INITIAL",
        amount: "450000000.00",
        effectiveDate: new Date(Date.UTC(2026, 10, 1)),
        createdById: userId,
      },
    });
    const created = await createSupplement(projectId, {
      amount: "75000000.00",
    });
    const supplementId = (created.json.data as { id: string }).id;

    const submitted = await callRoute(submitRoute, {
      cookie,
      method: "POST",
      params: { id: supplementId },
      body: {
        version: 1,
        submittedDate: "2026-11-06",
        approvalEmailDate: "2026-11-05",
      },
    });
    expect(submitted.status).toBe(200);

    const levels = await prisma.approvalLevelSnapshot.findMany({
      where: { arSupplementId: supplementId },
      orderBy: { levelNo: "asc" },
      select: { id: true },
    });
    for (const level of levels) {
      const decision = await callRoute(decisionRoute, {
        cookie,
        method: "POST",
        params: { levelId: level.id },
        body: {
          result: "APPROVED",
          approverName: "Bapak EM",
          decisionDate: "2026-11-08",
        },
      });
      expect(decision.status).toBe(200);
    }

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project.status).toBe("AFCE_AR_APPROVED");

    const budget = await readJson<{
      data: { official: string; entries: { type: string; amount: string }[] };
    }>(await callRoute(budgetRoute, { cookie, params: { id: projectId } }));
    expect(budget.data.official).toBe("525000000.00");
    expect(
      budget.data.entries.filter((entry) => entry.type === "INITIAL"),
    ).toHaveLength(1);
    expect(
      budget.data.entries.filter((entry) => entry.type === "AR_SUPPLEMENT"),
    ).toHaveLength(1);
  });

  it("AC-25 AR tambahan ditolak tidak menambah anggaran", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const created = await createSupplement(projectId, {
      amount: "10000000.00",
    });
    const supplementId = (created.json.data as { id: string }).id;

    await callRoute(submitRoute, {
      cookie,
      method: "POST",
      params: { id: supplementId },
      body: {
        version: 1,
        submittedDate: "2026-11-06",
        approvalEmailDate: "2026-11-05",
      },
    });
    const levels = await prisma.approvalLevelSnapshot.findMany({
      where: { arSupplementId: supplementId },
      orderBy: { levelNo: "asc" },
      select: { id: true },
    });
    const first = levels[0]!;
    await callRoute(decisionRoute, {
      cookie,
      method: "POST",
      params: { levelId: first.id },
      body: {
        result: "DITOLAK",
        approverName: "Bapak EM",
        decisionDate: "2026-11-08",
      },
    });

    const supplement = await prisma.arSupplement.findUniqueOrThrow({
      where: { id: supplementId },
      select: { status: true },
    });
    expect(supplement.status).toBe("DITOLAK");
    const entries = await prisma.budgetEntry.count({
      where: { projectId, type: "AR_SUPPLEMENT" },
    });
    expect(entries).toBe(0);
  });

  it("AC-25 proyek Selesai atau Dibatalkan menolak AR tambahan", async () => {
    const selesai = await projectAt("COMPLETED");
    const cancelled = await projectAt("CANCELLED");

    for (const projectId of [selesai, cancelled]) {
      const { response, json } = await createSupplement(projectId);
      expect(response.status).toBe(409);
      expect(json.error?.code).toBe("PROJECT_LOCKED");
    }
  });

  it("AR tambahan dengan nominal nol ditolak validasi", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const { response, json } = await createSupplement(projectId, {
      amount: "0.00",
    });
    expect(response.status).toBe(400);
    expect(json.error?.message).toBeTruthy();
  });

  it("AC-02 viewer tidak boleh membuat AR tambahan", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const response = await callRoute(createRoute, {
      cookie: viewerCookie,
      method: "POST",
      params: { id: projectId },
      body: {
        amount: "75000000.00",
        reason: "Penambahan pekerjaan chilled water",
        date: "2026-11-05",
      },
    });
    expect(response.status).toBe(403);
  });
});
