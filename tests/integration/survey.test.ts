import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import type { FileKind } from "@/shared/file";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as startSurveyRoute } from "@/app/api/projects/[id]/start-survey/route";
import {
  GET as getSurveyRoute,
  PUT as putSurveyRoute,
} from "@/app/api/projects/[id]/survey/route";

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

describe("API survei", () => {
  let cookieSpecialist: string;
  let cookieViewer: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    cookieViewer = await signIn(viewer.email, viewer.password);
    userId = specialist.id;
  });

  async function surveyProject(
    status: "DRAFT" | "SURVEY" | "WAITING_BAST" = "SURVEY",
  ) {
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

  async function uploadedFile(
    projectId: string,
    kind: FileKind,
    name: string,
    status: "PENDING" | "READY" = "READY",
  ): Promise<string> {
    const file = await prisma.fileObject.create({
      data: {
        projectId,
        kind,
        ownerType: "PendingUpload",
        ownerId: projectId,
        key: `projects/${projectId}/${kind.toLowerCase()}/${crypto.randomUUID()}.${name.split(".").pop()}`,
        originalName: name,
        mimeType:
          kind === "SPATIAL_DATA" ? "application/geo+json" : "image/jpeg",
        sizeBytes: 1024,
        status,
        uploadedById: userId,
      },
      select: { id: true },
    });
    return file.id;
  }

  function surveyBody(overrides: Record<string, unknown> = {}) {
    return {
      version: 1,
      surveyDate: "2026-10-05",
      surveyorNames: "Siti Rahma, Budi Santoso",
      existingCondition: "Saluran tersumbat sedimen, dinding kanan bocor",
      recommendation: "Pembersihan sedimen dan perbaikan dinding",
      latitude: "-3.123456",
      longitude: "102.654321",
      notes: "Akses menuju lokasi perlu izin manajer areal",
      photoFileIds: [],
      documentFileIds: [],
      spatialFileIds: [],
      ...overrides,
    };
  }

  it("AC-14 menyimpan survei lengkap dengan foto, dokumen, dan data spasial", async () => {
    const projectId = await surveyProject();
    const photoId = await uploadedFile(
      projectId,
      "PROGRESS_PHOTO",
      "saluran-1.jpg",
    );
    const documentId = await uploadedFile(
      projectId,
      "DOCUMENT",
      "notulensi.pdf",
    );
    const spatialId = await uploadedFile(
      projectId,
      "SPATIAL_DATA",
      "area.geojson",
    );

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({
        photoFileIds: [photoId],
        documentFileIds: [documentId],
        spatialFileIds: [spatialId],
      }),
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toMatchObject({
      id: expect.any(String),
      version: 1,
    });

    const detail = await readJson<{
      data: {
        surveyorNames: string;
        latitude: string;
        files: { photos: unknown[]; documents: unknown[]; spatial: unknown[] };
      };
    }>(
      await callRoute(getSurveyRoute, {
        cookie: cookieViewer,
        params: { id: projectId },
      }),
    );
    expect(detail.data.surveyorNames).toContain("Siti Rahma");
    expect(detail.data.latitude).toBe("-3.123456");
    expect(detail.data.files.photos).toHaveLength(1);
    expect(detail.data.files.documents).toHaveLength(1);
    expect(detail.data.files.spatial).toHaveLength(1);
  });

  it("AC-14 survei terkunci setelah AFCE pertama diajukan", async () => {
    const projectId = await surveyProject();
    await prisma.afceAttempt.create({
      data: {
        projectId,
        attemptNo: 1,
        status: "DIAJUKAN",
        basisAmount: "450000000",
        submittedDate: new Date(Date.UTC(2026, 9, 12)),
        approvalEmailDate: new Date(Date.UTC(2026, 9, 11)),
      },
    });

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody(),
    });
    expect(response.status).toBe(409);
    const body = await readJson<Envelope>(response);
    expect(body.error?.code).toBe("FIELD_INPUT_LOCKED");
    expect(body.error?.message).toContain("AFCE");
  });

  it("AC-14 berkas milik proyek lain ditolak", async () => {
    const projectId = await surveyProject();
    const otherProjectId = await surveyProject();
    const photoId = await uploadedFile(
      otherProjectId,
      "PROGRESS_PHOTO",
      "lain.jpg",
    );

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({ photoFileIds: [photoId] }),
    });
    expect(response.status).toBe(409);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "PRECONDITION_FAILED",
    );
  });

  it("AC-14 berkas yang belum selesai diunggah ditolak", async () => {
    const projectId = await surveyProject();
    const photoId = await uploadedFile(
      projectId,
      "PROGRESS_PHOTO",
      "pending.jpg",
      "PENDING",
    );

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({ photoFileIds: [photoId] }),
    });
    expect(response.status).toBe(409);
    expect((await readJson<Envelope>(response)).error?.message).toContain(
      "belum selesai",
    );
  });

  it("berkas dengan jenis yang salah pada isian foto ditolak", async () => {
    const projectId = await surveyProject();
    const documentId = await uploadedFile(
      projectId,
      "DOCUMENT",
      "notulensi.pdf",
    );

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({ photoFileIds: [documentId] }),
    });
    expect(response.status).toBe(400);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("survei hanya boleh diisi setelah Mulai Survei", async () => {
    const projectId = await surveyProject("DRAFT");

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody(),
    });
    expect(response.status).toBe(409);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("AC-02 viewer tidak boleh mengisi survei", async () => {
    const projectId = await surveyProject();

    const response = await callRoute(putSurveyRoute, {
      cookie: cookieViewer,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody(),
    });
    expect(response.status).toBe(403);
  });

  it("menyimpan survei memakai version dan menolak version lama", async () => {
    const projectId = await surveyProject();

    const first = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody(),
    });
    expect(first.status).toBe(200);
    expect(
      (await readJson<{ data: { version: number } }>(first)).data.version,
    ).toBe(1);

    const updated = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({ version: 1, notes: "Tambahan catatan lapangan" }),
    });
    expect(updated.status).toBe(200);
    expect(
      (await readJson<{ data: { version: number } }>(updated)).data.version,
    ).toBe(2);

    const stale = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({ version: 1, notes: "Perubahan kedua" }),
    });
    expect(stale.status).toBe(409);
    expect((await readJson<Envelope>(stale)).error?.code).toBe(
      "VERSION_CONFLICT",
    );

    const fresh = await callRoute(putSurveyRoute, {
      cookie: cookieSpecialist,
      method: "PUT",
      params: { id: projectId },
      body: surveyBody({ version: 2, notes: "Perubahan kedua" }),
    });
    expect(fresh.status).toBe(200);
  });

  it("proyek tanpa survei dibaca sebagai data kosong", async () => {
    const projectId = await surveyProject();
    const response = await callRoute(getSurveyRoute, {
      cookie: cookieViewer,
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
    expect((await readJson<Envelope>(response)).data).toBeNull();
  });

  it("Start Survei tetap mempertahankan proyek untuk alur survei", async () => {
    const projectId = await surveyProject("DRAFT");
    const response = await callRoute(startSurveyRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
  });
});
