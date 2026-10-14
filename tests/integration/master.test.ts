import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/infra/db";

import {
  GET as listRoute,
  POST as createRoute,
} from "@/app/api/master/[type]/route";
import {
  DELETE as deleteRoute,
  PATCH as updateRoute,
} from "@/app/api/master/[type]/[id]/route";
import { POST as quickMaterialRoute } from "@/app/api/master/materials/quick/route";
import { POST as quickVendorRoute } from "@/app/api/master/vendors/quick/route";
import { POST as createUserRoute } from "@/app/api/users/route";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";
import { listMasterRows, signIn } from "./helpers/master-api";

describe("API master data: izin, validasi, dan audit", () => {
  let specialistCookie: string;
  let viewerCookie: string;
  let actorId: string;
  let unitId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    specialistCookie = await signIn(specialist.email, specialist.password);
    viewerCookie = await signIn(viewer.email, viewer.password);
    actorId = specialist.id;
    const unit = await prisma.unit.create({
      data: { code: "uji-pcs", name: "Buatan uji" },
    });
    unitId = unit.id;
  });

  it("AC-02 viewer boleh membaca tetapi ditolak 403 pada semua mutasi", async () => {
    const list = await callRoute(listRoute, {
      cookie: viewerCookie,
      path: "/api/master/units",
      params: { type: "units" },
    });
    expect(list.status).toBe(200);
    const listBody = await readJson<{ data: unknown[] }>(list);
    expect(listBody.data.length).toBeGreaterThan(0);

    const created = await callRoute(createRoute, {
      cookie: viewerCookie,
      method: "POST",
      path: "/api/master/units",
      body: { code: "x1", name: "Unit viewer" },
      params: { type: "units" },
    });
    expect(created.status).toBe(403);

    const patched = await callRoute(updateRoute, {
      cookie: viewerCookie,
      method: "PATCH",
      path: `/api/master/units/${unitId}`,
      body: { name: "Diubah viewer" },
      params: { type: "units", id: unitId },
    });
    expect(patched.status).toBe(403);

    const removed = await callRoute(deleteRoute, {
      cookie: viewerCookie,
      method: "DELETE",
      path: `/api/master/units/${unitId}`,
      params: { type: "units", id: unitId },
    });
    expect(removed.status).toBe(403);

    await expect(prisma.unit.count({ where: { code: "x1" } })).resolves.toBe(0);
  });

  it("AC-03 specialist boleh mengubah master, tetapi kelola user tetap 403", async () => {
    const created = await callRoute(createRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/master/vendors",
      body: { name: "CV Uji Specialist", type: "EKSTERNAL" },
      params: { type: "vendors" },
    });
    expect(created.status).toBe(200);

    const userCreate = await callRoute(createUserRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/users",
      body: {
        email: "baru@wm.test",
        name: "Baru",
        role: "MANAGEMENT_VIEWER",
        temporaryPassword: "PasswordBaru123!",
      },
    });
    expect(userCreate.status).toBe(403);
    await expect(
      prisma.user.count({ where: { email: "baru@wm.test" } }),
    ).resolves.toBe(0);
  });

  it("specialist membuat unit lewat route dan audit tercatat", async () => {
    const created = await callRoute(createRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/master/units",
      body: { code: "uji-ton", name: "Ton" },
      params: { type: "units" },
    });
    expect(created.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Unit", action: "CREATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.after).toMatchObject({ code: "uji-ton", name: "Ton" });
    expect(log?.actorId).toBe(actorId);
  });

  it("AC-06 kode duplikat menjawab 409 DUPLICATE, bukan 403", async () => {
    const response = await callRoute(createRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/master/units",
      body: { code: "uji-ton", name: "Ton dua" },
      params: { type: "units" },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DUPLICATE" },
    });
  });

  it("AC-06 isian tidak valid menjawab 400 dengan daftar field", async () => {
    const response = await callRoute(createRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/master/units",
      body: { code: "salah kode!", name: "" },
      params: { type: "units" },
    });
    expect(response.status).toBe(400);
    const body = await readJson<{
      error: { code: string; fields: Record<string, string> };
    }>(response);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fields).sort()).toEqual(["code", "name"]);
  });

  it("AC-01 tanpa session menjawab 401 JSON, bukan redirect", async () => {
    const response = await callRoute(listRoute, {
      path: "/api/master/units",
      params: { type: "units" },
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("filter lokasi berantai menyaring estate sesuai region", async () => {
    const region = await prisma.region.findFirstOrThrow({
      orderBy: { code: "asc" },
    });
    const rows = await listMasterRows<{
      id: string;
      wilayah: { region: { code: string } };
    }>(specialistCookie, "estates", { regionId: region.id });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.wilayah.region.code === region.code)).toBe(
      true,
    );
  });

  it("pembuatan cepat vendor dan material selalu belum lengkap", async () => {
    const quickVendor = await callRoute(quickVendorRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/master/vendors/quick",
      body: { name: "CV cepat", type: "EKSTERNAL" },
    });
    expect(quickVendor.status).toBe(200);
    const vendor = await readJson<{ data: { isComplete: boolean } }>(
      quickVendor,
    );
    expect(vendor.data.isComplete).toBe(false);

    const quickMaterial = await callRoute(quickMaterialRoute, {
      cookie: specialistCookie,
      method: "POST",
      path: "/api/master/materials/quick",
      body: { name: "Material cepat", defaultUnitId: unitId },
    });
    expect(quickMaterial.status).toBe(200);
    const material = await readJson<{ data: { isComplete: boolean } }>(
      quickMaterial,
    );
    expect(material.data.isComplete).toBe(false);
  });
});
