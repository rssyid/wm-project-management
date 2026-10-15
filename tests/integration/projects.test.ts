import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { PROJECT_STATUS_LABEL } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import {
  GET as getProjectRoute,
  PATCH as updateProjectRoute,
} from "@/app/api/projects/[id]/route";
import { PUT as estatesRoute } from "@/app/api/projects/[id]/estates/route";
import { POST as startSurveyRoute } from "@/app/api/projects/[id]/start-survey/route";
import { GET as historyRoute } from "@/app/api/projects/[id]/history/route";
import {
  GET as listProjectsRoute,
  POST as createProjectRoute,
} from "@/app/api/projects/route";

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

describe("API proyek", () => {
  let cookieSpecialist: string;
  let cookieViewer: string;
  let userId: string;
  let companyId: string;
  let companyCode: string;
  let categoryId: string;
  let estateAId: string;
  let estateBId: string;
  let estateBWilayahId: string;
  let estateBRegionId: string;
  let otherCompanyEstateId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    cookieViewer = await signIn(viewer.email, viewer.password);
    userId = specialist.id;

    const company = await prisma.company.findFirstOrThrow({
      orderBy: { code: "asc" },
      include: { estates: { include: { wilayah: true } } },
    });
    companyCode = company.code;
    companyId = company.id;
    categoryId = (await prisma.projectCategory.findFirstOrThrow()).id;

    const estateA = company.estates.at(0);
    const estateB = company.estates.find((estate) => estate.id !== estateA?.id);
    if (!estateA || !estateB) {
      throw new Error(
        "Seed lokasi harus punya minimal dua Estate pada Company pertama.",
      );
    }
    estateAId = estateA.id;
    estateBId = estateB.id;
    estateBWilayahId = estateB.wilayahId;
    estateBRegionId = estateB.wilayah.regionId;
    otherCompanyEstateId = (
      await prisma.estate.findFirstOrThrow({
        where: { companyId: { not: company.id } },
        orderBy: { code: "asc" },
      })
    ).id;
  });

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      name: "Normalisasi kanal blok A",
      companyId,
      categoryId,
      description: "Pengerjaan saluran dan perbaikan weir",
      picUserId: userId,
      targetStartDate: "2026-10-01",
      targetEndDate: "2026-12-20",
      plannedBudget: "450000000.00",
      estates: [{ estateId: estateAId, isPrimary: true }],
      ...overrides,
    };
  }

  async function createProject(body: Record<string, unknown> = {}) {
    const response = await callRoute(createProjectRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      body: payload(body),
    });
    return { response, json: await readJson<Envelope>(response) };
  }

  async function createProjectId(body: Record<string, unknown> = {}) {
    const { response, json } = await createProject(body);
    expect(response.status, JSON.stringify(json.error)).toBe(200);
    return (json.data as { id: string }).id;
  }

  it("AC-10 kode proyek berurutan per Company per tahun", async () => {
    const first = await createProject();
    expect(first.response.status).toBe(200);
    const second = await createProject({ name: "Pembersihan saluran" });

    const firstCode = (first.json.data as { code: string }).code;
    const secondCode = (second.json.data as { code: string }).code;
    const year = new Date().getFullYear();
    expect(firstCode).toMatch(new RegExp(`^WM-${companyCode}-${year}-\\d{4}$`));
    expect(Number(secondCode.slice(-4)) - Number(firstCode.slice(-4))).toBe(1);
  });

  it("AC-10 dua pembuatan bersamaan tidak menghasilkan kode sama", async () => {
    const results = await Promise.all([
      createProject({ name: "Paralel A" }),
      createProject({ name: "Paralel B" }),
    ]);
    const codes = results.map(
      (result) => (result.json.data as { code: string } | undefined)?.code,
    );
    expect(codes.every((code) => Boolean(code))).toBe(true);
    expect(new Set(codes).size).toBe(2);
  });

  it("AC-11 Estate milik Company lain ditolak 409", async () => {
    const { response, json } = await createProject({
      estates: [{ estateId: otherCompanyEstateId, isPrimary: true }],
    });
    expect(response.status).toBe(409);
    expect(json.error?.code).toBe("PRECONDITION_FAILED");
    expect(json.error?.message).toContain("bukan milik Company proyek");
  });

  it("AC-11 tepat satu Estate harus ditandai utama", async () => {
    const twoPrimary = await createProject({
      estates: [
        { estateId: estateAId, isPrimary: true },
        { estateId: estateBId, isPrimary: true },
      ],
    });
    expect(twoPrimary.response.status).toBe(400);
    expect(twoPrimary.json.error?.code).toBe("VALIDATION_ERROR");

    const noPrimary = await createProject({
      estates: [{ estateId: estateAId, isPrimary: false }],
    });
    expect(noPrimary.response.status).toBe(400);
  });

  it("AC-02 viewer tidak bisa membuat proyek", async () => {
    const response = await callRoute(createProjectRoute, {
      cookie: cookieViewer,
      method: "POST",
      body: payload(),
    });
    expect(response.status).toBe(403);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "FORBIDDEN_ROLE",
    );
  });

  it("AC-05 pembuatan proyek menulis satu AuditLog", async () => {
    const projectId = await createProjectId({ name: "Proyek ber-audit" });

    const logs = await prisma.auditLog.findMany({
      where: { projectId, entityType: "Project" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorId: userId, action: "CREATE" });
  });

  it("AC-12 Mulai Survei menolak proyek tanpa data dasar lengkap", async () => {
    const projectId = await createProjectId({
      name: "Tanpa PIC",
      picUserId: null,
      plannedBudget: null,
    });

    const response = await callRoute(startSurveyRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: projectId },
    });
    const body = await readJson<Envelope>(response);
    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("PRECONDITION_FAILED");
    expect(body.error?.message).toContain("PIC");
  });

  it("AC-12 Mulai Survei memindahkan proyek ke status Survei dan hanya sekali", async () => {
    const projectId = await createProjectId({ name: "Siap survei" });

    const response = await callRoute(startSurveyRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toMatchObject({
      status: "SURVEY",
    });

    const second = await callRoute(startSurveyRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: projectId },
    });
    expect(second.status).toBe(409);
    expect((await readJson<Envelope>(second)).error?.code).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("AC-13 proyek multi-Estate muncul di filter wilayah dan region Estate kedua", async () => {
    const projectId = await createProjectId({
      name: "Dua Estate dua Wilayah",
      estates: [
        { estateId: estateAId, isPrimary: true },
        { estateId: estateBId, isPrimary: false },
      ],
    });

    for (const query of [
      `wilayahIds=${estateBWilayahId}`,
      `regionIds=${estateBRegionId}`,
      `estateIds=${estateBId}`,
    ]) {
      const response = await callRoute(listProjectsRoute, {
        cookie: cookieViewer,
        path: `/api/projects?${query}`,
      });
      const body = await readJson<Envelope>(response);
      const ids = (body.data as { id: string }[]).map((row) => row.id);
      expect(ids, `filter ${query}`).toContain(projectId);
    }
  });

  it("AC-13 daftar proyek difilter kata kunci dan status", async () => {
    const projectId = await createProjectId({ name: "Saluranbundel Theta" });

    const found = await callRoute(listProjectsRoute, {
      cookie: cookieViewer,
      path: "/api/projects?q=theta",
    });
    const foundRows = (await readJson<Envelope>(found)).data as {
      id: string;
    }[];
    expect(foundRows.map((row) => row.id)).toEqual([projectId]);

    const byStatus = await callRoute(listProjectsRoute, {
      cookie: cookieViewer,
      path: "/api/projects?status=SURVEY",
    });
    const rows = (await readJson<Envelope>(byStatus)).data as {
      status: string;
    }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === "SURVEY")).toBe(true);
  });

  it("AC-13 daftar proyek mengirim uang sebagai string dan label status tersedia", async () => {
    const response = await callRoute(listProjectsRoute, {
      cookie: cookieViewer,
    });
    const rows = (await readJson<Envelope>(response)).data as {
      code: string;
      status: string;
      plannedBudget: string | null;
      mainEstate: { code: string; wilayah: string } | null;
    }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        PROJECT_STATUS_LABEL[row.status as keyof typeof PROJECT_STATUS_LABEL],
      ).toBeTruthy();
      if (row.plannedBudget !== null) {
        expect(row.plannedBudget).toMatch(/^\d+\.\d{2}$/);
      }
      expect(row.mainEstate?.code).toBeTruthy();
    }
  });

  it("AC-15 riwayat proyek menampilkan perubahan status", async () => {
    const projectId = await createProjectId({ name: "Proyek riwayat" });
    await callRoute(startSurveyRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: projectId },
    });

    const response = await callRoute(historyRoute, {
      cookie: cookieViewer,
      params: { id: projectId },
    });
    const body = await readJson<{
      data: { statusHistory: { toStatus: string }[] };
    }>(response);
    expect(response.status).toBe(200);
    expect(body.data.statusHistory[0]?.toStatus).toBe("SURVEY");
  });

  it("AC-06 mengubah proyek dengan version lama ditolak VERSION_CONFLICT", async () => {
    const projectId = await createProjectId({ name: "Proyek versi" });

    const response = await callRoute(updateProjectRoute, {
      cookie: cookieSpecialist,
      method: "PATCH",
      params: { id: projectId },
      body: { version: 99, name: "Nama baru" },
    });
    expect(response.status).toBe(409);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "VERSION_CONFLICT",
    );
  });

  it("mengubah proyek menaikkan version dan menulis audit", async () => {
    const projectId = await createProjectId({ name: "Proyek versi lama" });

    const response = await callRoute(updateProjectRoute, {
      cookie: cookieSpecialist,
      method: "PATCH",
      params: { id: projectId },
      body: { version: 1, name: "Normalisasi kanal blok B" },
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toMatchObject({
      version: 2,
    });

    const logs = await prisma.auditLog.findMany({
      where: { projectId, action: "UPDATE" },
    });
    expect(logs).toHaveLength(1);
  });

  it("AC-11 lokasi proyek bisa diganti sebelum PROCUREMENT dan terkunci sesudahnya", async () => {
    const projectId = await createProjectId({ name: "Ganti lokasi" });

    const response = await callRoute(estatesRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: {
        version: 1,
        estates: [
          { estateId: estateBId, isPrimary: true },
          { estateId: estateAId, isPrimary: false },
        ],
      },
    });
    expect(response.status).toBe(200);

    const detail = await readJson<Envelope>(
      await callRoute(getProjectRoute, {
        cookie: cookieViewer,
        params: { id: projectId },
      }),
    );
    const estates = (
      detail.data as {
        estates: { isPrimary: boolean; estate: { id: string } }[];
      }
    ).estates;
    expect(estates.find((estate) => estate.isPrimary)?.estate.id).toBe(
      estateBId,
    );

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "PROCUREMENT" },
    });
    const locked = await callRoute(estatesRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: { version: 2, estates: [{ estateId: estateAId, isPrimary: true }] },
    });
    expect(locked.status).toBe(409);
    expect((await readJson<Envelope>(locked)).error?.code).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("AC-01 tanpa session mendapat 401", async () => {
    const response = await callRoute(listProjectsRoute, {
      path: "/api/projects",
    });
    expect(response.status).toBe(401);
  });

  it("proyek yang tidak ada dibaca sebagai 404", async () => {
    const response = await callRoute(getProjectRoute, {
      cookie: cookieViewer,
      params: { id: "tidak-ada" },
    });
    expect(response.status).toBe(404);
  });
});
