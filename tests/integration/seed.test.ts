import { beforeAll, describe, expect, it } from "vitest";

import { runSeed } from "../../prisma/seed/run";
import { prisma } from "@/infra/db";

const EXPECTED = {
  lokasi: { regions: 8, wilayah: 18, companies: 27, estates: 63 },
  master: {
    units: 16,
    projectCategories: 6,
    materials: 13,
    heavyEquipmentTypes: 7,
    approvalPositions: 9,
  },
};

describe("seed lokasi, master, dan Super Admin", () => {
  beforeAll(async () => {
    await runSeed();
  });

  it("AC-61 menghasilkan 8 Region, 18 Wilayah, 27 Company, 63 Estate", async () => {
    const [regions, wilayah, companies, estates] = await Promise.all([
      prisma.region.count(),
      prisma.wilayah.count(),
      prisma.company.count(),
      prisma.estate.count(),
    ]);
    expect({ regions, wilayah, companies, estates }).toEqual(EXPECTED.lokasi);
  });

  it("AC-61 mengisi master dari seed-data/master.json", async () => {
    const [units, categories, materials, equipment, positions, settings] =
      await Promise.all([
        prisma.unit.count(),
        prisma.projectCategory.count(),
        prisma.material.count(),
        prisma.heavyEquipmentType.count(),
        prisma.approvalPosition.count(),
        prisma.systemSetting.count(),
      ]);
    expect({
      units,
      projectCategories: categories,
      materials,
      heavyEquipmentTypes: equipment,
      approvalPositions: positions,
      systemSettings: settings,
    }).toEqual({ ...EXPECTED.master, systemSettings: 1 });

    const setting = await prisma.systemSetting.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(setting.workingWeekdays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(setting.ewsYellowFrom.toString()).toBe("5");
    expect(setting.ewsRedAbove.toString()).toBe("10");
  });

  it("AC-61 material seed belum lengkap dan tier matriks masih kosong", async () => {
    const incomplete = await prisma.material.count({
      where: { isComplete: false },
    });
    expect(incomplete).toBe(EXPECTED.master.materials);
    expect(await prisma.approvalMatrixTier.count()).toBe(0);
    expect(await prisma.holiday.count()).toBe(0);
  });

  it("AC-61 membuat Super Admin pertama dengan wajib ganti password", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "SUPER_ADMIN" },
    });
    expect(admin.mustChangePassword).toBe(true);
    const account = await prisma.account.findFirstOrThrow({
      where: { userId: admin.id },
    });
    expect(account.providerId).toBe("credential");
    expect(account.password).toBeTruthy();
  });

  it("AC-61 idempoten: jalan dua kali tidak menambah baris", async () => {
    const before = {
      regions: await prisma.region.count(),
      estates: await prisma.estate.count(),
      units: await prisma.unit.count(),
      users: await prisma.user.count(),
    };

    const second = await runSeed();
    expect(second.superAdminCreated).toBe(false);

    const after = {
      regions: await prisma.region.count(),
      estates: await prisma.estate.count(),
      units: await prisma.unit.count(),
      users: await prisma.user.count(),
    };
    expect(after).toEqual(before);
  });

  it("AC-61 menulis AuditLog IMPORT untuk tiap kelompok data", async () => {
    const logs = await prisma.auditLog.findMany({
      where: { action: "IMPORT" },
      orderBy: { entityType: "asc" },
    });
    expect(logs.map((log) => log.entityType)).toEqual([
      "Lokasi",
      "Lokasi",
      "Master",
      "Master",
    ]);
    expect(logs[0]?.after).toEqual(EXPECTED.lokasi);
  });
});
