import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { GET as auditLogsRoute } from "@/app/api/audit-logs/route";

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

async function createAuditEntry(
  projectId: string,
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  return prisma.auditLog.create({
    data: {
      actorId,
      projectId,
      entityType,
      entityId,
      action,
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

describe("API audit log (AC-05)", () => {
  let cookieViewer: string;
  let projectId: string;
  let actorId: string;

  beforeAll(async () => {
    await ensureSeed();
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookieViewer = await signIn(viewer.email, viewer.password);
    actorId = specialist.id;

    const project = await prisma.project.create({
      data: {
        code: `WM-TEST-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        name: "Proyek Audit Uji",
        companyId: (await prisma.company.findFirstOrThrow()).id,
        categoryId: (await prisma.projectCategory.findFirstOrThrow()).id,
        picUserId: actorId,
        createdById: actorId,
      },
      select: { id: true },
    });
    projectId = project.id;

    await createAuditEntry(projectId, actorId, "Project", project.id, "UPDATE", { a: 1 }, { a: 2 });
    await createAuditEntry(projectId, actorId, "BastDocument", "bast-1", "CREATE", null, { n: 1 });
  });

  async function list(query: string, cookie: string) {
    const response = await callRoute(auditLogsRoute, {
      cookie,
      path: `/api/audit-logs?${query}`,
    });
    const body = await readJson<Envelope>(response);
    return { response, body };
  }

  it("AC-05 semua role bisa membaca audit log dengan before/after", async () => {
    const { response, body } = await list("", cookieViewer);
    expect(response.status).toBe(200);
    const rows = body.data as {
      id: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
    }[];
    expect(rows.length).toBeGreaterThan(0);
    const ours = rows.find((r) => r.entityId === projectId);
    expect(ours).toBeDefined();
    expect(ours?.before).toEqual({ a: 1 });
    expect(ours?.after).toEqual({ a: 2 });
  });

  it("AC-05 filter projectId", async () => {
    const { body } = await list(`projectId=${projectId}`, cookieViewer);
    const rows = body.data as { projectId: string }[];
    expect(rows.every((r) => r.projectId === projectId)).toBe(true);
  });

  it("AC-05 filter entityType", async () => {
    const { body } = await list(`entityType=BastDocument`, cookieViewer);
    const rows = body.data as { entityType: string }[];
    expect(rows.every((r) => r.entityType === "BastDocument")).toBe(true);
  });

  it("AC-05 filter actorId", async () => {
    const { body } = await list(`actorId=${actorId}`, cookieViewer);
    const rows = body.data as { actorId: string }[];
    expect(rows.every((r) => r.actorId === actorId)).toBe(true);
  });

  it("AC-05 filter from/to tanggal", async () => {
    const from = "2026-01-01";
    const to = "2026-12-31";
    const { response, body } = await list(`from=${from}&to=${to}`, cookieViewer);
    expect(response.status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it("AC-01 tanpa session audit log 401", async () => {
    const response = await callRoute(auditLogsRoute, { path: "/api/audit-logs" });
    expect(response.status).toBe(401);
  });

  it("pagination meta tersedia", async () => {
    const { body } = await list("", cookieViewer);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25, total: expect.any(Number) });
  });
});
