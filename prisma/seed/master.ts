import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

type SeedData = {
  units: { code: string; name: string }[];
  projectCategories: { code: string; name: string; order: number }[];
  materials: { name: string; defaultUnitCode: string }[];
  heavyEquipmentTypes: { name: string }[];
  approvalPositions: { code: string; name: string; rank: number }[];
  systemSetting: {
    workingWeekdays: number[];
    ewsYellowFrom: string;
    ewsRedAbove: string;
  };
};

const seed = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../seed-data/master.json", import.meta.url)),
    "utf8",
  ),
) as SeedData;

export type MasterCounts = {
  units: number;
  projectCategories: number;
  materials: number;
  heavyEquipmentTypes: number;
  approvalPositions: number;
};

/**
 * docs/03 §5: satuan, kategori proyek, material (isComplete=false sampai dilengkapi),
 * jenis alat berat, jabatan approver, dan SystemSetting baris 1. Tier matriks dan hari libur
 * sengaja kosong karena diisi lewat aplikasi.
 */
export async function seedMaster(): Promise<MasterCounts> {
  return prisma.$transaction(async (tx) => {
    const existingUnits = await tx.unit.findMany();
    const unitIdByCode = new Map(
      existingUnits.map((row) => [row.code, row.id]),
    );
    const newUnits = seed.units
      .filter((unit) => !unitIdByCode.has(unit.code))
      .map((unit) => ({ code: unit.code, name: unit.name }));
    if (newUnits.length > 0) {
      await tx.unit.createMany({ data: newUnits });
      for (const row of await tx.unit.findMany())
        unitIdByCode.set(row.code, row.id);
    }

    const existingCategories = await tx.projectCategory.findMany();
    const newCategories = seed.projectCategories
      .filter(
        (category) =>
          !existingCategories.some((row) => row.code === category.code),
      )
      .map((category) => ({
        code: category.code,
        name: category.name,
        order: category.order,
      }));
    if (newCategories.length > 0) {
      await tx.projectCategory.createMany({ data: newCategories });
    }

    const existingMaterials = await tx.material.findMany();
    const materialNames = new Set(existingMaterials.map((row) => row.name));
    const newMaterials = seed.materials.flatMap((material) => {
      const defaultUnitId = unitIdByCode.get(material.defaultUnitCode);
      if (!defaultUnitId) {
        throw new Error(
          `Material "${material.name}" tanpa satuan ${material.defaultUnitCode}`,
        );
      }
      if (materialNames.has(material.name)) return [];
      return [{ name: material.name, defaultUnitId, isComplete: false }];
    });
    if (newMaterials.length > 0) {
      await tx.material.createMany({ data: newMaterials });
    }

    const existingEquipment = await tx.heavyEquipmentType.findMany();
    const equipmentNames = new Set(existingEquipment.map((row) => row.name));
    const newEquipment = seed.heavyEquipmentTypes
      .filter((equipment) => !equipmentNames.has(equipment.name))
      .map((equipment) => ({ name: equipment.name }));
    if (newEquipment.length > 0) {
      await tx.heavyEquipmentType.createMany({ data: newEquipment });
    }

    const existingPositions = await tx.approvalPosition.findMany();
    const positionCodes = new Set(existingPositions.map((row) => row.code));
    const newPositions = seed.approvalPositions
      .filter((position) => !positionCodes.has(position.code))
      .map((position) => ({
        code: position.code,
        name: position.name,
        rank: position.rank,
      }));
    if (newPositions.length > 0) {
      await tx.approvalPosition.createMany({ data: newPositions });
    }

    const setting = {
      workingWeekdays: seed.systemSetting.workingWeekdays,
      ewsYellowFrom: new Prisma.Decimal(seed.systemSetting.ewsYellowFrom),
      ewsRedAbove: new Prisma.Decimal(seed.systemSetting.ewsRedAbove),
    };
    await tx.systemSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...setting },
      update: {},
    });

    return {
      units: seed.units.length,
      projectCategories: seed.projectCategories.length,
      materials: seed.materials.length,
      heavyEquipmentTypes: seed.heavyEquipmentTypes.length,
      approvalPositions: seed.approvalPositions.length,
    };
  });
}
