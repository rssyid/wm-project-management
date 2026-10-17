import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as createTenderAttemptRoute } from "@/app/api/work-items/[id]/tender-attempts/route";
import { PUT as setWinnerRoute } from "@/app/api/tender-attempts/[id]/winner/route";

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

describe("Pemenang tender (AC-36)", () => {
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

  async function createWI(projectId: string) {
    return prisma.workItem.create({
      data: {
        projectId,
        name: "Pekerjaan Uji",
        type: "TENDER_CONTRACT",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("100.00"),
        materialWeightPct: new Prisma.Decimal("0.00"),
      },
    });
  }

  async function createAttempt(workItemId: string) {
    return callRoute(createTenderAttemptRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        uspk: { number: "USPK/2026/001", date: "2026-10-06" },
      },
    });
  }

  it("AC-36 pemenang nama baru → vendor isComplete=false, lengkap otomatis saat semua field terisi", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const res = await createAttempt(wi.id);
    const attempt = (await readJson<Envelope>(res)).data as { id: string };

    const response = await callRoute(setWinnerRoute, {
      cookie,
      method: "PUT",
      params: { id: attempt.id },
      body: { vendorName: "CV. Jaya Abadi" },
    });
    expect(response.status).toBe(200);
    const json = await readJson<Envelope>(response);
    expect(json.data).toMatchObject({
      winnerNameSnapshot: "CV. Jaya Abadi",
    });

    const vendor = await prisma.vendor.findFirst({
      where: { name: "CV. Jaya Abadi" },
    });
    expect(vendor?.isComplete).toBe(false);
  });
});
