import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { prisma } from "@/infra/db";
import { Ops } from "@/generated/prisma/client";

type SeedData = {
  regions: { code: string; name: string; ops: string; order: number }[];
  wilayah: { regionCode: string; name: string; order: number }[];
  companies: { code: string; name: string; order: number }[];
  estates: {
    companyCode: string;
    code: string;
    name: string;
    wilayahName: string;
    regionCode: string;
    estateNew?: string;
    legacyCode?: string;
    order: number;
  }[];
};

const seed = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../seed-data/lokasi.json", import.meta.url)),
    "utf8",
  ),
) as SeedData;

export type LokasiCounts = {
  regions: number;
  wilayah: number;
  companies: number;
  estates: number;
};

/**
 * docs/03 §5: 8 Region, 18 Wilayah, 27 Company, 63 Estate. Idempoten pada kunci alami
 * (Region.code, (regionId,name) Wilayah, Company.code, (companyId,code) Estate): hanya baris
 * yang belum ada yang ditambahkan, jadi perubahan lewat master tidak ditimpa.
 */
export async function seedLokasi(): Promise<LokasiCounts> {
  return prisma.$transaction(async (tx) => {
    const existingRegions = await tx.region.findMany();
    const regionIdByCode = new Map(
      existingRegions.map((row) => [row.code, row.id]),
    );
    const newRegions = seed.regions
      .filter((region) => !regionIdByCode.has(region.code))
      .map((region) => ({
        code: region.code,
        name: region.name,
        ops: region.ops as Ops,
        order: region.order,
      }));
    if (newRegions.length > 0) {
      await tx.region.createMany({ data: newRegions });
      const created = await tx.region.findMany();
      for (const row of created) regionIdByCode.set(row.code, row.id);
    }

    const wilayahRows = await tx.wilayah.findMany();
    let wilayahIdByKey = new Map(
      wilayahRows.map((row) => [`${row.regionId}|${row.name}`, row.id]),
    );
    const newWilayah = seed.wilayah.flatMap((wilayah) => {
      const regionId = regionIdByCode.get(wilayah.regionCode);
      if (!regionId) {
        throw new Error(
          `Wilayah "${wilayah.name}" tanpa Region ${wilayah.regionCode}`,
        );
      }
      if (wilayahIdByKey.has(`${regionId}|${wilayah.name}`)) return [];
      return [{ regionId, name: wilayah.name, order: wilayah.order }];
    });
    if (newWilayah.length > 0) {
      await tx.wilayah.createMany({ data: newWilayah });
      wilayahIdByKey = new Map(
        (await tx.wilayah.findMany()).map((row) => [
          `${row.regionId}|${row.name}`,
          row.id,
        ]),
      );
    }

    const existingCompanies = await tx.company.findMany();
    const companyIdByCode = new Map(
      existingCompanies.map((row) => [row.code, row.id]),
    );
    const newCompanies = seed.companies
      .filter((company) => !companyIdByCode.has(company.code))
      .map((company) => ({
        code: company.code,
        name: company.name,
        order: company.order,
      }));
    if (newCompanies.length > 0) {
      await tx.company.createMany({ data: newCompanies });
      const created = await tx.company.findMany();
      for (const row of created) companyIdByCode.set(row.code, row.id);
    }

    const existingEstates = await tx.estate.findMany();
    const estateKeys = new Set(
      existingEstates.map((row) => `${row.companyId}|${row.code}`),
    );
    const newEstates = seed.estates.flatMap((estate) => {
      const companyId = companyIdByCode.get(estate.companyCode);
      if (!companyId) {
        throw new Error(
          `Estate ${estate.code} tanpa Company ${estate.companyCode}`,
        );
      }
      const wilayahId = wilayahIdByKey.get(
        `${regionIdByCode.get(estate.regionCode)}|${estate.wilayahName}`,
      );
      if (!wilayahId) {
        throw new Error(
          `Estate ${estate.code} tanpa Wilayah ${estate.wilayahName} di ${estate.regionCode}`,
        );
      }
      if (estateKeys.has(`${companyId}|${estate.code}`)) return [];
      return [
        {
          companyId,
          code: estate.code,
          name: estate.name,
          wilayahId,
          estateNew: estate.estateNew,
          legacyCode: estate.legacyCode,
          order: estate.order,
        },
      ];
    });
    if (newEstates.length > 0) {
      await tx.estate.createMany({ data: newEstates });
    }

    return {
      regions: seed.regions.length,
      wilayah: seed.wilayah.length,
      companies: seed.companies.length,
      estates: seed.estates.length,
    };
  });
}
