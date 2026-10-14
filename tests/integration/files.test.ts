import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { deleteStalePendingFiles } from "@/domain/files/service";
import { presignUpload, removeObject, statObject } from "@/infra/r2";

import { POST as uploadUrlRoute } from "@/app/api/files/upload-url/route";
import { POST as confirmRoute } from "@/app/api/files/[id]/confirm/route";
import { GET as downloadUrlRoute } from "@/app/api/files/[id]/download-url/route";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

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

const createdKeys: string[] = [];

async function cleanupKeys() {
  for (const key of createdKeys.splice(0)) {
    await removeObject(key);
  }
}

describe("berkas R2", () => {
  let specialistCookie: string;
  let viewerCookie: string;
  let projectId: string;
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    specialistCookie = await signIn(specialist.email, specialist.password);
    viewerCookie = await signIn(viewer.email, viewer.password);
    userId = specialist.id;
    const { project } = await createProject({ createdById: specialist.id });
    projectId = project.id;
  });

  it("AC-62 foto lebih dari 5 MB ditolak 413", async () => {
    const response = await callRoute(uploadUrlRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/files/upload-url",
      body: {
        kind: "PROGRESS_PHOTO",
        projectId,
        ownerType: "WorkItem",
        ownerId: "uji",
        originalName: "progres.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 6 * 1024 * 1024,
      },
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FILE_TOO_LARGE" },
    });
  });

  it("AC-62 dokumen lebih dari 10 MB ditolak 413", async () => {
    const response = await callRoute(uploadUrlRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/files/upload-url",
      body: {
        kind: "DOCUMENT",
        projectId,
        ownerType: "WorkItem",
        ownerId: "uji",
        originalName: "spesifikasi.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024,
      },
    });
    expect(response.status).toBe(413);
  });

  it("AC-62 data spasial hanya menerima zip dan geojson", async () => {
    const response = await callRoute(uploadUrlRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/files/upload-url",
      body: {
        kind: "SPATIAL_DATA",
        projectId,
        ownerType: "Project",
        ownerId: projectId,
        originalName: "peta.kml",
        mimeType: "application/vnd.google-earth.kml+xml",
        sizeBytes: 1024,
      },
    });
    expect(response.status).toBe(400);
  });

  it("AC-62 viewer tidak boleh membuat URL unggah", async () => {
    const response = await callRoute(uploadUrlRoute, {
      cookie: viewerCookie,
      method: "POST",
      path: "/api/files/upload-url",
      body: {
        kind: "DOCUMENT",
        projectId,
        ownerType: "WorkItem",
        ownerId: "uji",
        originalName: "berkas.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      },
    });
    expect(response.status).toBe(403);
  });

  it("AC-62 unggah ke bucket dev, confirm, lalu unduh lewat URL berumur pendek", async () => {
    const created = await callRoute(uploadUrlRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/files/upload-url",
      body: {
        kind: "DOCUMENT",
        projectId,
        ownerType: "WorkItem",
        ownerId: "uji",
        originalName: "laporan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
    });
    expect(created.status).toBe(200);
    const upload = await readJson<{
      data: {
        fileId: string;
        key: string;
        url: string;
        expiresInSeconds: number;
      };
    }>(created);
    createdKeys.push(upload.data.key);
    expect(upload.data.expiresInSeconds).toBe(900);

    const pending = await prisma.fileObject.findUniqueOrThrow({
      where: { id: upload.data.fileId },
    });
    expect(pending.status).toBe("PENDING");

    // Confirm sebelum objek ada harus 409, bukan READY palsu.
    const early = await callRoute(confirmRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: `/api/files/${upload.data.fileId}/confirm`,
      params: { id: upload.data.fileId },
    });
    expect(early.status).toBe(409);

    const body = Buffer.from("%PDF-1.4 berkas uji AC-62");
    const put = await fetch(upload.data.url, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body,
    });
    expect(put.ok).toBe(true);

    const confirmed = await callRoute(confirmRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: `/api/files/${upload.data.fileId}/confirm`,
      params: { id: upload.data.fileId },
    });
    expect(confirmed.status).toBe(200);

    const stored = await prisma.fileObject.findUniqueOrThrow({
      where: { id: upload.data.fileId },
    });
    expect(stored.status).toBe("READY");
    expect(stored.sizeBytes).toBe(body.byteLength);

    const download = await callRoute(downloadUrlRoute, {
      cookie: viewerCookie,
      path: `/api/files/${upload.data.fileId}/download-url`,
      params: { id: upload.data.fileId },
    });
    expect(download.status).toBe(200);
    const link = await readJson<{
      data: { url: string; expiresInSeconds: number };
    }>(download);
    expect(link.data.expiresInSeconds).toBe(300);

    const url = new URL(link.data.url);
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");

    const fetched = await fetch(link.data.url);
    expect(fetched.status).toBe(200);
    await expect(fetched.text()).resolves.toContain("berkas uji AC-62");

    const downloadPending = await callRoute(downloadUrlRoute, {
      cookie: viewerCookie,
      path: `/api/files/${upload.data.fileId}/download-url`,
      params: { id: upload.data.fileId },
    });
    expect(downloadPending.status).toBe(200);
  });

  it("AC-62 berkas PENDING lebih dari 24 jam dibersihkan", async () => {
    const stale = await prisma.fileObject.create({
      data: {
        projectId,
        kind: "DOCUMENT",
        ownerType: "WorkItem",
        ownerId: "uji",
        key: `projects/${projectId}/document/${crypto.randomUUID()}-stale.pdf`,
        originalName: "usang.pdf",
        mimeType: "application/pdf",
        sizeBytes: 512,
        status: "PENDING",
        uploadedById: userId,
        uploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    });
    createdKeys.push(stale.key);
    await putObject(stale.key, "berkas usang");
    expect(await statObject(stale.key)).not.toBeNull();

    const result = await deleteStalePendingFiles();
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    await expect(
      prisma.fileObject.findUnique({ where: { id: stale.id } }),
    ).resolves.toBeNull();
    expect(await statObject(stale.key)).toBeNull();
  });

  it("confirm untuk berkas yang tidak ada menjawab 404", async () => {
    const response = await callRoute(confirmRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/files/tidak-ada/confirm",
      params: { id: "tidak-ada" },
    });
    expect(response.status).toBe(404);
  });

  afterAll(cleanupKeys);
});

/** Objek uji diunggah langsung ke bucket dev lewat URL bertanda tangan. */
async function putObject(key: string, content: string) {
  const signed = await presignUpload(key, "application/pdf");
  const response = await fetch(signed, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: content,
  });
  if (!response.ok)
    throw new Error(`Unggah objek uji gagal: ${response.status}`);
}
