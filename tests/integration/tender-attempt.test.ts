import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as createTenderAttemptRoute } from "@/app/api/work-items/[id]/tender-attempts/route";
import { POST as cancelTenderAttemptRoute } from "@/app/api/tender-attempts/[id]/cancel/route";

type Envelope = {
  data?: unknown;
  error?: { code: string; message: string };
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

describe("Tender attempt & USPK (AC-34, AC-35)", () => {
  let cookie: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
    userId = specialist.id;
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

  async function createWI(
    projectId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const wi = await prisma.workItem.create({
      data: {
        projectId,
        name: "Pekerjaan Uji",
        type: "TENDER_CONTRACT",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("100.00"),
        materialWeightPct: new Prisma.Decimal("0.00"),
        ...overrides,
      },
    });
    return wi;
  }

  async function createAttempt(
    workItemId: string,
    body: Record<string, unknown> = {},
  ) {
    return callRoute(createTenderAttemptRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        uspk: { number: "USPK/2026/001", date: "2026-10-06" },
        planTender: "Tender konvensional",
        planPhysical: "Fisik konvensional",
        ...body,
      },
    });
  }

  it("AC-34 USPK pertama → PROCUREMENT", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const wi = await createWI(projectId);
    const response = await createAttempt(wi.id);
    expect(response.status).toBe(200);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project?.status).toBe("PROCUREMENT");
  });

  it("AC-35 satu attempt aktif per Pekerjaan (ACTIVE_CONFLICT)", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    await createAttempt(wi.id, {
      uspk: { number: "USPK/2026/001", date: "2026-10-06" },
    });
    const response = await createAttempt(wi.id, {
      uspk: { number: "USPK/2026/002", date: "2026-10-07" },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("ACTIVE_CONFLICT");
  });

  it("AC-35 attempt batal tetap tampil", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const res1 = await createAttempt(wi.id, {
      uspk: { number: "USPK/2026/001", date: "2026-10-06" },
    });
    const attempt = (await readJson<Envelope>(res1)).data as { id: string };
    await callRoute(cancelTenderAttemptRoute, {
      cookie,
      method: "POST",
      params: { id: attempt.id },
      body: { cancelledDate: "2026-10-10", cancelReason: "Dibatalkan" },
    });
    const attempts = await prisma.tenderAttempt.findMany({
      where: { workItemId: wi.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.status).toBe("CANCELLED");
  });
});
