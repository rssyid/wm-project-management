import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as submitBastRoute } from "@/app/api/projects/[id]/bast/route";
import { POST as verifyBastRoute } from "@/app/api/bast/[id]/verify/route";
import { POST as cancelBastRoute } from "@/app/api/bast/[id]/cancel/route";

type Envelope = {
  data?: unknown;
  error?: { code: string; message: string };
  meta?: { page: number; pageSize: number; total: number };
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

async function domainError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if ((error as { code?: string }).code) return (error as { code: string }).code;
    throw error;
  }
  throw new Error("Fungsi seharusnya melempar error.");
}

const TARGET_START = new Date(Date.UTC(2026, 9, 1));
const TARGET_END = new Date(Date.UTC(2026, 10, 30));

async function createExecutionProjectWithPhysical100(
  actorId: string,
  companyId: string,
  categoryId: string,
  estateId: string,
) {
  const project = await prisma.project.create({
    data: {
      code: `WM-TEST-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      name: "Proyek BAST Uji",
      companyId,
      categoryId,
      picUserId: actorId,
      targetStartDate: TARGET_START,
      targetEndDate: TARGET_END,
      plannedBudget: new Prisma.Decimal("500000000.00"),
      status: "EXECUTION",
      createdById: actorId,
      estates: { create: { estateId, isPrimary: true } },
    },
  });

  const workItem = await prisma.workItem.create({
    data: {
      projectId: project.id,
      name: "Pekerjaan Fisik",
      type: "TENDER_CONTRACT",
      projectWeightPct: new Prisma.Decimal("100.00"),
      physicalWeightPct: new Prisma.Decimal("100.00"),
      materialWeightPct: new Prisma.Decimal("0.00"),
    },
  });

  const physicalProcess = await prisma.physicalProcess.create({
    data: {
      workItemId: workItem.id,
      status: "SELESAI",
      actualStart: TARGET_START,
      actualEnd: TARGET_END,
    },
  });

  await prisma.progressLog.create({
    data: {
      physicalProcessId: physicalProcess.id,
      weekStart: TARGET_START,
      cumulativePct: new Prisma.Decimal("100.00"),
      recordedById: actorId,
    },
  });

  return project;
}

describe("API BAST (AC-63–66)", () => {
  let cookieSpecialist: string;
  let cookieSuperAdmin: string;
  let cookieViewer: string;
  let companyId: string;
  let categoryId: string;
  let estateId: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    cookieSuperAdmin = await signIn(superAdmin.email, superAdmin.password);
    cookieViewer = await signIn(viewer.email, viewer.password);
    userId = specialist.id;

    const company = await prisma.company.findFirstOrThrow({
      orderBy: { code: "asc" },
    });
    companyId = company.id;
    categoryId = (await prisma.projectCategory.findFirstOrThrow()).id;
    estateId = (
      await prisma.estate.findFirstOrThrow({
        where: { companyId },
        orderBy: { code: "asc" },
      })
    ).id;
  });

  async function doSubmitBast(
    projectId: string,
    cookie: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await callRoute(submitBastRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: {
        number: "BAST-001",
        date: "2026-10-20",
        fileId: crypto.randomUUID(),
        ...body,
      },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  async function doVerifyBast(bastId: string, cookie: string) {
    const response = await callRoute(verifyBastRoute, {
      cookie,
      method: "POST",
      params: { id: bastId },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  async function doCancelBast(
    bastId: string,
    cookie: string,
    reason = "Alasan batal",
  ) {
    const response = await callRoute(cancelBastRoute, {
      cookie,
      method: "POST",
      params: { id: bastId },
      body: { bastId, reason },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  it("AC-63 SP dapat mengajukan BAST saat fisik 100% → WAITING_BAST", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );

    const { response, json } = await doSubmitBast(project.id, cookieSpecialist);
    expect(response.status).toBe(200);
    expect((json.data as { projectStatus: string }).projectStatus).toBe(
      "WAITING_BAST",
    );

    const bast = await prisma.bastDocument.findFirst({
      where: { projectId: project.id },
    });
    expect(bast?.status).toBe("DIAJUKAN");

    const refreshed = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(refreshed?.status).toBe("WAITING_BAST");
  });

  it("AC-63 ajukan BAST ditolak bila fisik belum 100%", async () => {
    const { project } = await createProject({
      createdById: userId,
      picUserId: userId,
      targetStartDate: TARGET_START,
      targetEndDate: TARGET_END,
      plannedBudget: "500000000.00",
      status: "EXECUTION",
    });

    const code = await domainError(doSubmitBast(project.id, cookieSpecialist));
    expect(code).toBe("PRECONDITION_FAILED");
  });

  it("AC-63 MV tidak bisa mengajukan BAST (403)", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );
    const { response, json } = await doSubmitBast(project.id, cookieViewer);
    expect(response.status).toBe(403);
    expect(json.error?.code).toBe("FORBIDDEN_ROLE");
  });

  it("AC-63 tidak boleh ada dua BAST DIAJUKAN per proyek", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );
    await doSubmitBast(project.id, cookieSpecialist, {
      number: "BAST-001",
    });
    const code = await domainError(
      doSubmitBast(project.id, cookieSpecialist, { number: "BAST-002" }),
    );
    expect(code).toBe("ACTIVE_CONFLICT");
  });

  it("AC-65 verifikasi BAST (SA) → COMPLETED, PROJECT_LOCKED setelahnya", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );
    const { json } = await doSubmitBast(project.id, cookieSpecialist);
    const bastId = (json.data as { id: string }).id;

    const { response, json: vjson } = await doVerifyBast(bastId, cookieSuperAdmin);
    expect(response.status).toBe(200);
    expect((vjson.data as { projectStatus: string }).projectStatus).toBe(
      "COMPLETED",
    );

    const bast = await prisma.bastDocument.findUnique({ where: { id: bastId } });
    expect(bast?.status).toBe("TERVERIFIKASI");
    expect(bast?.verifiedById).toBeDefined();

    const refreshed = await prisma.project.findUnique({ where: { id: project.id } });
    expect(refreshed?.status).toBe("COMPLETED");

    const code = await domainError(
      doSubmitBast(project.id, cookieSpecialist, { number: "BAST-002" }),
    );
    expect(code).toBe("PROJECT_LOCKED");
  });

  it("AC-65 SP tidak bisa verifikasi BAST (403 bast.manage)", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );
    const { json } = await doSubmitBast(project.id, cookieSpecialist);
    const bastId = (json.data as { id: string }).id;

    const { response, json: vjson } = await doVerifyBast(bastId, cookieSpecialist);
    expect(response.status).toBe(403);
    expect(vjson.error?.code).toBe("FORBIDDEN_ROLE");
  });

  it("AC-66 batal pengajuan BAST → EXECUTION, DIBATALKAN", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );
    const { json } = await doSubmitBast(project.id, cookieSpecialist);
    const bastId = (json.data as { id: string }).id;

    const { response, json: cjson } = await doCancelBast(
      bastId,
      cookieSuperAdmin,
      "Alasan batal",
    );
    expect(response.status).toBe(200);
    expect((cjson.data as { projectStatus: string }).projectStatus).toBe(
      "EXECUTION",
    );

    const bast = await prisma.bastDocument.findUnique({ where: { id: bastId } });
    expect(bast?.status).toBe("DIBATALKAN");
    expect(bast?.cancelReason).toBe("Alasan batal");

    const refreshed = await prisma.project.findUnique({ where: { id: project.id } });
    expect(refreshed?.status).toBe("EXECUTION");
  });

  it("AC-66 batal BAST yang sudah diverifikasi ditolak", async () => {
    const project = await createExecutionProjectWithPhysical100(
      userId,
      companyId,
      categoryId,
      estateId,
    );
    const { json } = await doSubmitBast(project.id, cookieSpecialist);
    const bastId = (json.data as { id: string }).id;
    await doVerifyBast(bastId, cookieSuperAdmin);

    const code = await domainError(doCancelBast(bastId, cookieSuperAdmin));
    expect(code).toBe("INVALID_TRANSITION");
  });
});
