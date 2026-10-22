import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { DELETE as deleteProjectRoute } from "@/app/api/projects/[id]/route";
import { POST as purgeProjectRoute } from "@/app/api/projects/[id]/purge/route";

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

async function domainError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if ((error as { code?: string }).code) return (error as { code: string }).code;
    throw error;
  }
  throw new Error("Fungsi seharusnya melempar error.");
}

async function draftProject(actorId: string, companyId: string, categoryId: string, estateId: string) {
  return prisma.project.create({
    data: {
      code: `WM-TEST-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      name: "Proyek Purge Uji",
      companyId,
      categoryId,
      picUserId: actorId,
      targetStartDate: new Date(Date.UTC(2026, 9, 1)),
      targetEndDate: new Date(Date.UTC(2026, 10, 30)),
      plannedBudget: new Prisma.Decimal("500000000.00"),
      status: "DRAFT",
      createdById: actorId,
      estates: { create: { estateId, isPrimary: true } },
    },
    select: { id: true, code: true },
  });
}

describe("API soft delete / purge proyek (AC-70)", () => {
  let cookieSuperAdmin: string;
  let cookieSpecialist: string;
  let companyId: string;
  let categoryId: string;
  let estateId: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookieSuperAdmin = await signIn(superAdmin.email, superAdmin.password);
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    userId = superAdmin.id;

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

  async function doSoftDelete(projectId: string, cookie: string, reason = "Alasan hapus") {
    const response = await callRoute(deleteProjectRoute, {
      cookie,
      method: "DELETE",
      params: { id: projectId },
      body: { reason },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  async function doPurge(projectId: string, cookie: string, code: string) {
    const response = await callRoute(purgeProjectRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: { projectId, code },
    });
    return { response, json: (await readJson<Envelope>(response)) as Envelope };
  }

  it("AC-70 soft delete → 404 saat dibaca, restore bisa, purge hanya SA", async () => {
    const project = await draftProject(userId, companyId, categoryId, estateId);

    const { response, json } = await doSoftDelete(project.id, cookieSpecialist);
    expect(response.status).toBe(403);
    expect(json.error?.code).toBe("FORBIDDEN_ROLE");

    const { response: r2 } = await doSoftDelete(project.id, cookieSuperAdmin);
    expect(r2.status).toBe(200);

    const softDeleted = await prisma.project.findUnique({ where: { id: project.id } });
    expect(softDeleted?.deletedAt).not.toBeNull();
    expect(softDeleted?.deletedById).toBe(userId);

    const r3 = await callRoute(deleteProjectRoute, {
      cookie: cookieSuperAdmin,
      method: "GET",
      params: { id: project.id },
    });
    expect(r3.status).toBe(404);

    await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: null, deletedById: null, deleteReason: null },
    });
  });

  it("AC-70 purge hanya untuk ter-soft delete + konfirmasi kode", async () => {
    const project = await draftProject(userId, companyId, categoryId, estateId);

    const code1 = await domainError(doPurge(project.id, cookieSuperAdmin, project.code));
    expect(code1).toBe("INVALID_TRANSITION");

    await doSoftDelete(project.id, cookieSuperAdmin);

    const code2 = await domainError(doPurge(project.id, cookieSuperAdmin, "SALAH"));
    expect(code2).toBe("VALIDATION_ERROR");

    await prisma.fileObject.create({
      data: {
        projectId: project.id,
        kind: "DOCUMENT",
        ownerType: "Project",
        ownerId: project.id,
        key: `projects/${project.id}/DOCUMENT/${crypto.randomUUID()}`,
        originalName: "lampiran.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        status: "READY",
        uploadedById: userId,
      },
    });

    const { response } = await doPurge(project.id, cookieSuperAdmin, project.code);
    expect(response.status).toBe(200);

    const gone = await prisma.project.findUnique({ where: { id: project.id } });
    expect(gone).toBeNull();

    const tombstone = await prisma.projectTombstone.findUnique({
      where: { projectId: project.id },
    });
    expect(tombstone).not.toBeNull();
    expect(tombstone?.code).toBe(project.code);

    const files = await prisma.fileObject.findMany({ where: { projectId: project.id } });
    expect(files.length).toBe(0);

    const logs = await prisma.auditLog.findMany({ where: { projectId: project.id } });
    expect(logs.length).toBeGreaterThan(0);

    await expect(
      prisma.projectTombstone.create({
        data: {
          projectId: "tidak-ada",
          code: project.code,
          name: "X",
          purgedById: userId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("AC-70 MV dan Specialist tidak bisa purge", async () => {
    const project = await draftProject(userId, companyId, categoryId, estateId);
    await doSoftDelete(project.id, cookieSuperAdmin);

    const { response, json } = await doPurge(project.id, cookieSpecialist, project.code);
    expect(response.status).toBe(403);
    expect(json.error?.code).toBe("FORBIDDEN_ROLE");
  });
});
