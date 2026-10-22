import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { GET as listProjectsRoute } from "@/app/api/projects/route";

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

const ONE_YEAR_AGO = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
const RECENT = new Date();

async function createClosedProject(
  actorId: string,
  companyId: string,
  categoryId: string,
  estateId: string,
  status: "COMPLETED" | "CANCELLED",
  closedAt: Date,
) {
  return prisma.project.create({
    data: {
      code: `WM-TEST-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      name: "Proyek Arsip Uji",
      companyId,
      categoryId,
      picUserId: actorId,
      targetStartDate: closedAt,
      targetEndDate: closedAt,
      plannedBudget: new Prisma.Decimal("500000000.00"),
      status,
      createdById: actorId,
      ...(status === "COMPLETED" ? { completedAt: closedAt } : { cancelledAt: closedAt }),
      estates: { create: { estateId, isPrimary: true } },
    },
    select: { id: true, code: true, status: true },
  });
}

describe("API arsip proyek (AC-69)", () => {
  let cookieViewer: string;
  let companyId: string;
  let categoryId: string;
  let estateId: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    cookieViewer = await signIn(viewer.email, viewer.password);
    userId = viewer.id;

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

  async function listProjects(query: string) {
    const response = await callRoute(listProjectsRoute, {
      cookie: cookieViewer,
      path: `/api/projects?${query}`,
    });
    const body = await readJson<Envelope>(response);
    return { response, body };
  }

  it("AC-69 arsip otomatis 1 tahun setelah COMPLETED/CANCELLED, muncul dengan filter archived", async () => {
    const oldCompleted = await createClosedProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "COMPLETED",
      ONE_YEAR_AGO,
    );
    const oldCancelled = await createClosedProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "CANCELLED",
      ONE_YEAR_AGO,
    );
    const recentCompleted = await createClosedProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "COMPLETED",
      RECENT,
    );

    // Default (archived=false): tidak menampilkan arsip ≥ 1 tahun
    const { body: active } = await listProjects("");
    const activeIds = (active.data as { id: string }[]).map((r) => r.id);
    expect(activeIds).not.toContain(oldCompleted.id);
    expect(activeIds).not.toContain(oldCancelled.id);
    expect(activeIds).toContain(recentCompleted.id);

    // archived=true: menampilkan arsip ≥ 1 tahun
    const { body: archived } = await listProjects("archived=true");
    const archivedIds = (archived.data as { id: string }[]).map((r) => r.id);
    expect(archivedIds).toContain(oldCompleted.id);
    expect(archivedIds).toContain(oldCancelled.id);
    expect(archivedIds).not.toContain(recentCompleted.id);

    // Setiap baris arsip punya properti archived=true
    const archivedRows = archived.data as { archived: boolean; id: string }[];
    expect(archivedRows.every((r) => r.archived === true)).toBe(true);

    // Tidak ada data yang dihapus (deletedAt null)
    const dbOld = await prisma.project.findUnique({ where: { id: oldCompleted.id } });
    expect(dbOld?.deletedAt).toBeNull();
    expect(dbOld?.status).toBe("COMPLETED");
  });

  it("AC-69 proyek COMPLETED/CANCELled baru (< 1 tahun) tidak dianggap arsip", async () => {
    const recent = await createClosedProject(
      userId,
      companyId,
      categoryId,
      estateId,
      "CANCELLED",
      RECENT,
    );
    const { body: archived } = await listProjects("archived=true");
    const archivedIds = (archived.data as { id: string }[]).map((r) => r.id);
    expect(archivedIds).not.toContain(recent.id);
  });
});
