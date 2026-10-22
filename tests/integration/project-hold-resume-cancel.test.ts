import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { POST as holdRoute } from "@/app/api/projects/[id]/hold/route";
import { POST as resumeRoute } from "@/app/api/projects/[id]/resume/route";
import { POST as cancelRoute } from "@/app/api/projects/[id]/cancel/route";

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

async function domainError(
  result: Promise<{ response: Response; json: Envelope }>,
): Promise<string> {
  const { response, json } = await result;
  if (json.error?.code) return json.error.code;
  throw new Error(
    `Fungsi seharusnya melempar error, tetapi berhasil dengan status ${response.status}.`,
  );
}

const TARGET_START = new Date(Date.UTC(2026, 9, 1));
const TARGET_END = new Date(Date.UTC(2026, 10, 30));

async function draftProject(
  actorId: string,
  companyId: string,
  categoryId: string,
  estateId: string,
  status: ProjectStatus = "DRAFT",
) {
  return prisma.project.create({
    data: {
      code: `WM-TEST-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      name: "Proyek Tahan Uji",
      companyId,
      categoryId,
      picUserId: actorId,
      targetStartDate: TARGET_START,
      targetEndDate: TARGET_END,
      plannedBudget: new Prisma.Decimal("500000000.00"),
      status,
      createdById: actorId,
      estates: { create: { estateId, isPrimary: true } },
    },
    select: { id: true, status: true },
  });
}

describe("API tahan/lanjutkan/batal proyek (AC-67, AC-68)", () => {
  let cookieSpecialist: string;
  let cookieSuperAdmin: string;
  let companyId: string;
  let categoryId: string;
  let estateId: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    cookieSuperAdmin = await signIn(superAdmin.email, superAdmin.password);
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

  async function doHold(
    projectId: string,
    cookie: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await callRoute(holdRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: { reason: "Musim hujan", ...body },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  async function doResume(projectId: string, cookie: string) {
    const response = await callRoute(resumeRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  async function doCancel(
    projectId: string,
    cookie: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await callRoute(cancelRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: { reason: "Dana tidak tersedia", ...body },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  it("AC-67 tahan menyimpan status sebelumnya dan lanjutkan mengembalikannya", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "SURVEY",
    );

    const { response } = await doHold(project.id, cookieSpecialist);
    expect(response.status).toBe(200);

    const held = await prisma.project.findUnique({ where: { id: project.id } });
    expect(held?.status).toBe("ON_HOLD");
    expect(held?.previousStatus).toBe("SURVEY");
    expect(held?.onHoldReason).toBe("Musim hujan");

    const { response: r2 } = await doResume(project.id, cookieSpecialist);
    expect(r2.status).toBe(200);

    const resumed = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(resumed?.status).toBe("SURVEY");
    expect(resumed?.previousStatus).toBeNull();
    expect(resumed?.onHoldReason).toBeNull();
  });

  it("AC-67 proyek DRAFT tidak bisa ditahan", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "DRAFT",
    );
    const code = await domainError(doHold(project.id, cookieSpecialist));
    expect(code).toBe("INVALID_TRANSITION");
  });

  it("AC-67 proyek COMPLETED tidak bisa ditahan", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "COMPLETED",
    );
    const code = await domainError(doHold(project.id, cookieSpecialist));
    expect(code).toBe("INVALID_TRANSITION");
  });

  it("AC-67 SP tidak bisa resume dari non-ON_HOLD", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "SURVEY",
    );
    const { response, json } = await doResume(project.id, cookieSpecialist);
    expect(response.status).toBe(409);
    expect(json.error?.code).toBe("INVALID_TRANSITION");
  });

  it("AC-68 batal proyek hanya SA, alasan wajib, riwayat tetap terbaca", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "DRAFT",
    );

    const { response, json } = await doCancel(project.id, cookieSpecialist);
    expect(response.status).toBe(403);
    expect(json.error?.code).toBe("FORBIDDEN_ROLE");

    const { response: r2 } = await doCancel(project.id, cookieSuperAdmin);
    expect(r2.status).toBe(200);

    const cancelled = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(cancelled?.status).toBe("CANCELLED");
    expect(cancelled?.cancelReason).toBe("Dana tidak tersedia");
    expect(cancelled?.cancelledById).toBeDefined();

    const history = await prisma.projectStatusHistory.findMany({
      where: { projectId: project.id },
      orderBy: { at: "asc" },
    });
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((h) => h.toStatus === "CANCELLED")).toBe(true);
  });

  it("AC-68 batal proyek dari COMPLETED ditolak", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "COMPLETED",
    );
    const code = await domainError(doCancel(project.id, cookieSuperAdmin));
    expect(code).toBe("INVALID_TRANSITION");
  });

  it("AC-01 tanpa session hold/resume/cancel mendapat 401", async () => {
    const project = await draftProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "SURVEY",
    );
    const h = await callRoute(holdRoute, {
      method: "POST",
      params: { id: project.id },
      body: { reason: "x" },
    });
    expect(h.status).toBe(401);
    const r = await callRoute(resumeRoute, {
      method: "POST",
      params: { id: project.id },
    });
    expect(r.status).toBe(401);
    const c = await callRoute(cancelRoute, {
      method: "POST",
      params: { id: project.id },
      body: { reason: "x" },
    });
    expect(c.status).toBe(401);
  });
});
