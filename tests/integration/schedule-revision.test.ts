import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { PATCH as updateBaselineRoute } from "@/app/api/schedule-baselines/[id]/route";
import { POST as createRevisionRoute } from "@/app/api/schedule-baselines/[id]/revisions/route";

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

describe("AC-45, AC-46 revisi jadwal dan kunci baseline", () => {
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
      ...(status === "ON_HOLD" ? { previousStatus: "PROCUREMENT" } : {}),
    });
    return project.id;
  }

  async function baselineLocked(projectId: string) {
    const wi = await prisma.workItem.create({
      data: {
        projectId,
        name: "Pekerjaan Uji",
        type: "TENDER_CONTRACT",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("100.00"),
        materialWeightPct: new Prisma.Decimal("0.00"),
      },
    });
    const attempt = await prisma.tenderAttempt.create({
      data: {
        workItemId: wi.id,
        attemptNo: 1,
        status: "COMPLETED",
      },
    });
    const baseline = await prisma.scheduleBaseline.create({
      data: {
        processType: "TENDER_ATTEMPT",
        tenderAttemptId: attempt.id,
        plannedStart: new Date(Date.UTC(2026, 9, 1)),
        plannedEnd: new Date(Date.UTC(2026, 10, 30)),
        lockedAt: new Date(Date.UTC(2026, 9, 15)),
        lockedById: userId,
      },
    });
    return { baselineId: baseline.id };
  }

  async function baselineUnlocked(projectId: string) {
    const wi = await prisma.workItem.create({
      data: {
        projectId,
        name: "Pekerjaan Uji",
        type: "TENDER_CONTRACT",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("100.00"),
        materialWeightPct: new Prisma.Decimal("0.00"),
      },
    });
    const attempt = await prisma.tenderAttempt.create({
      data: { workItemId: wi.id, attemptNo: 1, status: "COMPLETED" },
    });
    const baseline = await prisma.scheduleBaseline.create({
      data: {
        processType: "TENDER_ATTEMPT",
        tenderAttemptId: attempt.id,
        plannedStart: new Date(Date.UTC(2026, 9, 1)),
        plannedEnd: new Date(Date.UTC(2026, 10, 30)),
        lockedAt: null,
      },
    });
    return { baselineId: baseline.id };
  }

  it("AC-45 baseline terkunci tidak bisa diubah langsung (409 INVALID_TRANSITION)", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const { baselineId } = await baselineLocked(projectId);

    const response = await callRoute(updateBaselineRoute, {
      cookie,
      method: "PATCH",
      params: { id: baselineId },
      body: {
        version: 1,
        plannedStart: "2026-10-01",
        plannedEnd: "2026-11-30",
      },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("INVALID_TRANSITION");
  });

  it("AC-45 baseline yang belum dikunci bisa diubah langsung", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const { baselineId } = await baselineUnlocked(projectId);

    const response = await callRoute(updateBaselineRoute, {
      cookie,
      method: "PATCH",
      params: { id: baselineId },
      body: {
        version: 1,
        plannedStart: "2026-10-05",
        plannedEnd: "2026-11-05",
      },
    });
    expect(response.status).toBe(200);
    const json = await readJson<Envelope>(response);
    expect((json.data as { plannedStart: string }).plannedStart).toBe(
      "2026-10-05T00:00:00.000Z",
    );
    expect((json.data as { plannedEnd: string }).plannedEnd).toBe(
      "2026-11-05T00:00:00.000Z",
    );
  });

  it("AC-46 revisi ditolak saat proyek WAITING_BAST (409 FIELD_INPUT_LOCKED)", async () => {
    const projectId = await projectAt("WAITING_BAST");
    const { baselineId } = await baselineLocked(projectId);

    const response = await callRoute(createRevisionRoute, {
      cookie,
      method: "POST",
      params: { id: baselineId },
      body: {
        plannedStart: "2026-10-10",
        plannedEnd: "2026-11-10",
        reason: "Revisi karena cuaca",
      },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("FIELD_INPUT_LOCKED");
  });

  it("AC-46 revisi diterima saat proyek ON_HOLD", async () => {
    const projectId = await projectAt("ON_HOLD");
    const { baselineId } = await baselineLocked(projectId);

    const response = await callRoute(createRevisionRoute, {
      cookie,
      method: "POST",
      params: { id: baselineId },
      body: {
        plannedStart: "2026-10-10",
        plannedEnd: "2026-11-10",
        reason: "Revisi saat ditahan",
      },
    });
    expect(response.status).toBe(200);
    const json = await readJson<Envelope>(response);
    expect((json.data as { revisionNo: number }).revisionNo).toBe(1);
    expect((json.data as { reason: string }).reason).toBe(
      "Revisi saat ditahan",
    );
  });

  it("AC-46 revisi ditolak jika baseline belum dikunci (409 INVALID_TRANSITION)", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const { baselineId } = await baselineUnlocked(projectId);

    const response = await callRoute(createRevisionRoute, {
      cookie,
      method: "POST",
      params: { id: baselineId },
      body: {
        plannedStart: "2026-10-10",
        plannedEnd: "2026-11-10",
        reason: "Revisi tanpa kunci",
      },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("INVALID_TRANSITION");
  });
});
