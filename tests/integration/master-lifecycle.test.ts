import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/infra/db";
import {
  createMaster,
  deleteMaster,
  setMasterActive,
  updateMaster,
} from "@/domain/master/service";

import {
  DELETE as deleteRoute,
  PATCH as updateRoute,
} from "@/app/api/master/[type]/[id]/route";

import { callRoute } from "./helpers/call-route";
import {
  createProject,
  createUser,
  createWorkItem,
  ensureSeed,
} from "./helpers/factory";
import { listMasterRows, signIn } from "./helpers/master-api";

describe("siklus hidup master: IN_USE, hapus, dan version", () => {
  let specialistCookie: string;
  let actorId: string;
  let unitId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    specialistCookie = await signIn(specialist.email, specialist.password);
    actorId = specialist.id;
    const unit = await prisma.unit.create({
      data: { code: "siklus-pcs", name: "Satuan siklus" },
    });
    unitId = unit.id;
  });

  it("AC-60 data terpakai tidak bisa dihapus dan harus dinonaktifkan", async () => {
    const { project } = await createProject({ createdById: actorId });
    const workItem = await createWorkItem(project.id, { type: "SWAKELOLA" });
    const material = await prisma.material.create({
      data: { name: "Material terpakai", defaultUnitId: unitId },
    });
    await prisma.workPackage.create({
      data: {
        projectId: project.id,
        workItemId: workItem.id,
        name: "Paket uji",
        weightPct: 100,
        status: "PR_SUBMITTED",
        items: { create: { materialId: material.id, plannedQty: "1", unitId } },
      },
    });

    const response = await callRoute(deleteRoute, {
      cookie: specialistCookie,
      method: "DELETE",
      path: `/api/master/materials/${material.id}`,
      params: { type: "materials", id: material.id },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "IN_USE" },
    });

    const deactivated = await setMasterActive(
      "materials",
      material.id,
      false,
      actorId,
    );
    expect((deactivated as { isActive: boolean }).isActive).toBe(false);

    const activeOnly = await listMasterRows(specialistCookie, "materials", {
      active: true,
    });
    expect(activeOnly.some((row) => row.id === material.id)).toBe(false);

    const all = await listMasterRows(specialistCookie, "materials");
    expect(all.find((row) => row.id === material.id)?.isActive).toBe(false);
  });

  it("AC-60 data yang tidak terpakai bisa dihapus", async () => {
    const vendor = (await createMaster(
      "vendors",
      { name: "CV Sementara", type: "EKSTERNAL" },
      actorId,
    )) as { id: string };

    await deleteMaster("vendors", vendor.id, actorId);
    await expect(
      prisma.vendor.findUnique({ where: { id: vendor.id } }),
    ).resolves.toBeNull();
  });

  it("AC-06 vendor dengan version salah menjawab 409 VERSION_CONFLICT", async () => {
    const vendor = (await createMaster(
      "vendors",
      { name: "CV Versi", type: "EKSTERNAL" },
      actorId,
    )) as { id: string; version: number };

    const updated = await updateMaster(
      "vendors",
      vendor.id,
      { name: "CV Versi 2" },
      vendor.version,
      actorId,
    );
    expect(updated).toMatchObject({ name: "CV Versi 2" });

    await expect(
      updateMaster(
        "vendors",
        vendor.id,
        { name: "CV Versi 3" },
        vendor.version,
        actorId,
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("AC-60 nonaktifkan lewat route mengubah isActive dan menaikkan version", async () => {
    const vendor = (await createMaster(
      "vendors",
      { name: "CV Nonaktif", type: "EKSTERNAL" },
      actorId,
    )) as { id: string; version: number };

    const response = await callRoute(updateRoute, {
      cookie: specialistCookie,
      method: "PATCH",
      path: `/api/master/vendors/${vendor.id}`,
      body: { isActive: false },
      params: { type: "vendors", id: vendor.id },
    });
    expect(response.status).toBe(200);

    const stored = await prisma.vendor.findUniqueOrThrow({
      where: { id: vendor.id },
    });
    expect(stored.isActive).toBe(false);
    expect(stored.version).toBe(vendor.version + 1);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: vendor.id, action: "DEACTIVATE" },
    });
    expect(log.after).toMatchObject({ isActive: false });
  });

  it("mengaktifkan kembali menulis audit UPDATE", async () => {
    const vendor = (await createMaster(
      "vendors",
      { name: "CV Aktif Kembali", type: "EKSTERNAL" },
      actorId,
    )) as { id: string };

    await setMasterActive("vendors", vendor.id, false, actorId);
    await setMasterActive("vendors", vendor.id, true, actorId);

    const stored = await prisma.vendor.findUniqueOrThrow({
      where: { id: vendor.id },
    });
    expect(stored.isActive).toBe(true);
    const logs = await prisma.auditLog.count({
      where: { entityId: vendor.id, action: "UPDATE" },
    });
    expect(logs).toBeGreaterThanOrEqual(1);
  });
});
