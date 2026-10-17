import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as createSpkRoute } from "@/app/api/work-items/[id]/spks/route";
import { POST as releaseSpkRoute } from "@/app/api/spks/[id]/release/route";

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

describe("SPK (AC-37, AC-38, AC-39)", () => {
  let cookie: string;
  let userId: string;
  let vendorExternalId: string;
  let vendorInternalId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
    userId = specialist.id;

    vendorExternalId = (
      await prisma.vendor.create({
        data: { name: "Vendor Eksternal", type: "EKSTERNAL", isActive: true },
        select: { id: true },
      })
    ).id;
    vendorInternalId = (
      await prisma.vendor.create({
        data: { name: "Vendor Internal", type: "INTERNAL", isActive: true },
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

  async function createWI(
    projectId: string,
    type: "TENDER_CONTRACT" | "SWAKELOLA" = "TENDER_CONTRACT",
  ) {
    return prisma.workItem.create({
      data: {
        projectId,
        name: "Pekerjaan Uji",
        type,
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("100.00"),
        materialWeightPct: new Prisma.Decimal("0.00"),
      },
    });
  }

  it("AC-37 SPK release pertama → attempt COMPLETED, actualEnd = tanggal release", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId, "TENDER_CONTRACT");
    const attempt = await prisma.tenderAttempt.create({
      data: {
        workItemId: wi.id,
        attemptNo: 1,
        status: "IN_PROGRESS",
        winnerVendorId: vendorExternalId,
        winnerNameSnapshot: "Vendor Eksternal",
        uspk: {
          create: {
            number: "USPK/2026/001",
            date: new Date("2026-10-06"),
            createdById: userId,
          },
        },
      },
    });
    const spk = await prisma.spk.create({
      data: {
        workItemId: wi.id,
        tenderAttemptId: attempt.id,
        vendorId: vendorExternalId,
        number: "SPK/001",
        date: new Date("2026-10-06"),
        status: "DRAFT",
      },
    });

    const response = await callRoute(releaseSpkRoute, {
      cookie,
      method: "POST",
      params: { id: spk.id },
      body: { releasedDate: "2026-10-10" },
    });
    expect(response.status).toBe(200);

    const attemptAfter = await prisma.tenderAttempt.findUnique({
      where: { id: attempt.id },
    });
    expect(attemptAfter?.status).toBe("COMPLETED");
    expect(attemptAfter?.actualEnd?.toISOString().slice(0, 10)).toBe(
      "2026-10-10",
    );
  });

  it("AC-38 SPK swakelola hanya vendor INTERNAL; pertama → PROCUREMENT", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const wi = await createWI(projectId, "SWAKELOLA");

    const response = await callRoute(createSpkRoute, {
      cookie,
      method: "POST",
      params: { id: wi.id },
      body: {
        number: "SPK-SW/001",
        date: "2026-10-06",
        vendorId: vendorInternalId,
      },
    });
    expect(response.status).toBe(200);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project?.status).toBe("PROCUREMENT");
  });

  it("AC-38 SPK swakelola menolak vendor eksternal", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId, "SWAKELOLA");

    const response = await callRoute(createSpkRoute, {
      cookie,
      method: "POST",
      params: { id: wi.id },
      body: {
        number: "SPK-SW/002",
        date: "2026-10-06",
        vendorId: vendorExternalId,
      },
    });
    expect(response.status).toBe(403);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("FORBIDDEN_ROLE");
  });
});
