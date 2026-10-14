import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/infra/db";

import {
  createProject,
  createUser,
  createWorkItem,
  ensureSeed,
} from "./helpers/factory";

describe("constraint database dari constraints.sql", () => {
  let userId: string;
  let projectId: string;
  let workItemId: string;

  beforeAll(async () => {
    await ensureSeed();
    const user = await createUser();
    userId = user.id;
    const { project } = await createProject({ createdById: userId });
    projectId = project.id;
    const workItem = await createWorkItem(projectId);
    workItemId = workItem.id;
  });

  it("CHECK: bobot fisik + material harus tepat 100", async () => {
    await expect(
      prisma.workItem.update({
        where: { id: workItemId },
        data: { physicalWeightPct: 60, materialWeightPct: 30 },
      }),
    ).rejects.toThrow(/workitem_weight_sum/);
  });

  it("CHECK: pekerjaan PURCHASE wajib 0 fisik dan 100 material", async () => {
    await expect(
      createWorkItem(projectId, { type: "PURCHASE" }),
    ).rejects.toThrow(/workitem_purchase_weights/);
  });

  it("partial unique: hanya satu Estate utama per proyek", async () => {
    const estate = await prisma.estate.findFirstOrThrow({
      where: { code: "RAM" },
    });
    await expect(
      prisma.projectEstate.create({
        data: { projectId, estateId: estate.id, isPrimary: true },
      }),
    ).rejects.toThrow(/projectestate_one_primary/);
  });

  it("partial unique: hanya satu tender attempt aktif per Pekerjaan", async () => {
    await prisma.tenderAttempt.create({
      data: { workItemId, attemptNo: 1, status: "PLANNED" },
    });
    await expect(
      prisma.tenderAttempt.create({
        data: { workItemId, attemptNo: 2, status: "PLANNED" },
      }),
    ).rejects.toThrow(/tenderattempt_one_active/);
  });

  it("trigger: AuditLog tidak bisa diubah atau dihapus, termasuk saat purge", async () => {
    const log = await prisma.auditLog.findFirstOrThrow();
    await expect(
      prisma.auditLog.update({
        where: { id: log.id },
        data: { action: "UBAH" },
      }),
    ).rejects.toThrow(/AuditLog tidak boleh diubah/);
    await expect(
      prisma.$transaction([
        prisma.$executeRawUnsafe(`SET LOCAL app.allow_purge = 'on'`),
        prisma.$executeRawUnsafe(
          `DELETE FROM "AuditLog" WHERE id = '${log.id}'`,
        ),
      ]),
    ).rejects.toThrow(/Tabel AuditLog tidak boleh diubah atau dihapus/);
  });

  it("trigger: PackageDelivery immutable, boleh dihapus hanya saat purge", async () => {
    const workPackage = await prisma.workPackage.create({
      data: { projectId, workItemId, name: "Paket Uji", weightPct: 0 },
    });
    const delivery = await prisma.packageDelivery.create({
      data: {
        workPackageId: workPackage.id,
        deliveryDate: new Date("2026-11-05"),
        recordedById: userId,
      },
    });

    await expect(
      prisma.packageDelivery.delete({ where: { id: delivery.id } }),
    ).rejects.toThrow(/PackageDelivery bersifat immutable/);

    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL app.allow_purge = 'on'`),
      prisma.packageDelivery.delete({ where: { id: delivery.id } }),
    ]);
    expect(await prisma.packageDelivery.count()).toBe(0);
  });

  it("trigger: ScheduleBaseline terkunci tidak bisa diubah", async () => {
    const otherWorkItem = await createWorkItem(projectId);
    const attempt = await prisma.tenderAttempt.create({
      data: { workItemId: otherWorkItem.id, attemptNo: 1 },
    });
    const baseline = await prisma.scheduleBaseline.create({
      data: {
        processType: "TENDER_ATTEMPT",
        tenderAttemptId: attempt.id,
        plannedStart: new Date("2026-11-01"),
        plannedEnd: new Date("2026-11-30"),
        lockedAt: new Date(),
      },
    });
    await expect(
      prisma.scheduleBaseline.update({
        where: { id: baseline.id },
        data: { plannedEnd: new Date("2026-12-31") },
      }),
    ).rejects.toThrow(/Baseline terkunci/);
  });
});
