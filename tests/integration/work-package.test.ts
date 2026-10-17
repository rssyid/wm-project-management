import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as createWorkPackageRoute } from "@/app/api/work-items/[id]/work-packages/route";
import { POST as createPRRoute } from "@/app/api/work-packages/[id]/pr/route";

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

describe("Paket Kerja & PR/PO (AC-40, AC-41)", () => {
  let cookie: string;
  let userId: string;
  let materialId: string;
  let unitId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
    userId = specialist.id;

    const material = await prisma.material.findFirstOrThrow({
      select: { id: true, defaultUnitId: true },
    });
    materialId = material.id;
    unitId = material.defaultUnitId;
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
        type: "PURCHASE",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("0.00"),
        materialWeightPct: new Prisma.Decimal("100.00"),
      },
    });
  }

  async function createWP(
    workItemId: string,
    body: Record<string, unknown> = {},
  ) {
    return callRoute(createWorkPackageRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        name: "Paket Uji",
        weightPct: "100.00",
        items: [
          {
            materialId,
            unitId,
            plannedQty: "10.000",
          },
        ],
        ...body,
      },
    });
  }

  it("AC-40 PR → PR_SUBMITTED, baseline paket dikunci, PR pertama → PROCUREMENT", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const wi = await createWI(projectId);
    const res = await createWP(wi.id);
    expect(res.status).toBe(200);
    const wp = (await readJson<Envelope>(res)).data as { id: string };

    const response = await callRoute(createPRRoute, {
      cookie,
      method: "POST",
      params: { id: wp.id },
      body: { number: "PR/2026/001", date: "2026-10-06" },
    });
    expect(response.status).toBe(200);

    const wpAfter = await prisma.workPackage.findUnique({
      where: { id: wp.id },
      select: { status: true },
    });
    expect(wpAfter?.status).toBe("PR_SUBMITTED");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project?.status).toBe("PROCUREMENT");
  });

  it("AC-41 kiriman sebelum PO → 409", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const res = await createWP(wi.id);
    const wp = (await readJson<Envelope>(res)).data as { id: string };
    await callRoute(createPRRoute, {
      cookie,
      method: "POST",
      params: { id: wp.id },
      body: { number: "PR/2026/002", date: "2026-10-06" },
    });

    const { POST: createDeliveryRoute } =
      await import("@/app/api/work-packages/[id]/deliveries/route");
    const response = await callRoute(createDeliveryRoute, {
      cookie,
      method: "POST",
      params: { id: wp.id },
      body: {
        deliveryDate: "2026-10-10",
        items: [{ workPackageItemId: "dummy", qty: "5.000" }],
      },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("PRECONDITION_FAILED");
  });
});
