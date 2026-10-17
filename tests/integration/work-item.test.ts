import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as createWorkItemRoute } from "@/app/api/projects/[id]/work-items/route";
import { PUT as putWeightsRoute } from "@/app/api/projects/[id]/work-item-weights/route";
import { POST as cancelWorkItemRoute } from "@/app/api/work-items/[id]/cancel/route";
import { PATCH as updateWorkItemRoute } from "@/app/api/work-items/[id]/route";

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

describe("Pekerjaan & bobot (AC-30, AC-31, AC-32)", () => {
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
    body: Record<string, unknown> = {},
  ) {
    return callRoute(createWorkItemRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: {
        name: "Pekerjaan Uji",
        type: "TENDER_CONTRACT",
        projectWeightPct: "100.00",
        physicalWeightPct: "100.00",
        materialWeightPct: "0.00",
        ...body,
      },
    });
  }

  it("AC-30 menolak Pekerjaan sebelum AFCE Approved (409)", async () => {
    const projectId = await projectAt("RAB_READY");
    const response = await createWI(projectId);
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("PRECONDITION_FAILED");
  });

  it("AC-31 membuat Pekerjaan setelah AFCE Approved dengan bobot 100", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const response = await createWI(projectId);
    expect(response.status).toBe(200);
    const json = await readJson<Envelope>(response);
    expect(json.data).toHaveProperty("id");
  });

  it("AC-33 tipe Pekerjaan tidak bisa diubah setelah dibuat (TYPE_LOCKED)", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    const created = await createWI(projectId);
    expect(created.status).toBe(200);
    const workItem = (await readJson<Envelope>(created)).data as {
      id: string;
      version: number;
      type: string;
    };
    expect(workItem.type).toBe("TENDER_CONTRACT");

    const response = await callRoute(updateWorkItemRoute, {
      cookie,
      method: "PATCH",
      params: { id: workItem.id },
      body: { version: workItem.version, type: "SWAKELOLA" },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("TYPE_LOCKED");

    // Tipe tetap seperti semula dan versi tidak naik karena mutasi ditolak.
    const after = await prisma.workItem.findUnique({
      where: { id: workItem.id },
      select: { type: true, version: true },
    });
    expect(after?.type).toBe("TENDER_CONTRACT");
    expect(after?.version).toBe(workItem.version);
  });

  it("AC-31 menolak total bobot Pekerjaan selain 100,00 (WEIGHT_MISMATCH)", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");
    await createWI(projectId, {
      name: "Pekerjaan A",
      projectWeightPct: "60.00",
    });
    const response = await callRoute(putWeightsRoute, {
      cookie,
      method: "PUT",
      params: { id: projectId },
      body: {
        version: 1,
        weights: [
          { workItemId: "dummy", projectWeightPct: "60.00" },
          { workItemId: "dummy2", projectWeightPct: "30.00" },
        ],
      },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("WEIGHT_MISMATCH");
  });

  it("AC-32 batal Pekerjaan wajib bobot pengganti dalam transaksi yang sama", async () => {
    const projectId = await projectAt("AFCE_AR_APPROVED");

    const resA = await createWI(projectId, {
      name: "Pekerjaan A",
      projectWeightPct: "100.00",
    });
    expect(resA.status).toBe(200);
    const wiA = (await readJson<Envelope>(resA)).data as { id: string };

    const resB = await createWI(projectId, {
      name: "Pekerjaan B",
      projectWeightPct: "0.00",
      physicalWeightPct: "100.00",
      materialWeightPct: "0.00",
    });
    expect(resB.status).toBe(200);
    const wiB = (await readJson<Envelope>(resB)).data as { id: string };

    // Redistribusi bobot: A=60, B=40
    const projectLatest = await prisma.project.findUnique({
      where: { id: projectId },
      select: { version: true },
    });
    await callRoute(putWeightsRoute, {
      cookie,
      method: "PUT",
      params: { id: projectId },
      body: {
        version: projectLatest!.version,
        weights: [
          { workItemId: wiA.id, projectWeightPct: "60.00" },
          { workItemId: wiB.id, projectWeightPct: "40.00" },
        ],
      },
    });

    const projectLatest2 = await prisma.project.findUnique({
      where: { id: projectId },
      select: { version: true },
    });

    const response = await callRoute(cancelWorkItemRoute, {
      cookie,
      method: "POST",
      params: { id: wiA.id },
      body: {
        version: projectLatest2!.version,
        reason: "Pekerjaan tidak terlaksana",
        weights: [{ workItemId: wiB.id, projectWeightPct: "100.00" }],
      },
    });
    expect(response.status).toBe(200);

    const canceled = await prisma.workItem.findUnique({
      where: { id: wiA.id },
    });
    expect(canceled?.cancelledAt).not.toBeNull();

    const wiBAfter = await prisma.workItem.findUnique({
      where: { id: wiB.id },
    });
    expect(wiBAfter?.projectWeightPct.toFixed(2)).toBe("100.00");
  });
});
