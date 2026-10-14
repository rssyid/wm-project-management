import { z } from "zod";

import type { Tx } from "@/infra/tx";
import { Prisma } from "@/generated/prisma/client";
import type { MasterType } from "@/shared/location";
import { DomainError } from "@/shared/errors";
import {
  blockSchema,
  blockUpdateSchema,
  companySchema,
  companyUpdateSchema,
  estateSchema,
  estateUpdateSchema,
  regionSchema,
  regionUpdateSchema,
  wilayahSchema,
  wilayahUpdateSchema,
} from "@/shared/schemas/master";

import { CATALOG_DEFINITIONS } from "./registry-catalog";

export type MasterFilters = {
  active?: boolean;
  q?: string;
  regionId?: string;
  companyId?: string;
  wilayahId?: string;
  estateId?: string;
};

/** Baris sebelum dan sesudah perubahan; dipakai service untuk AuditLog (AC-05). */
export type MasterUpdate = { before: unknown; after: unknown };

/**
 * Baris dikembalikan apa adanya oleh Prisma (termasuk relasi yang dibutuhkan UI); bentuk
 * akhirnya ditentukan oleh Zod di sisi klien, bukan di sini.
 */
export type MasterDefinition = {
  type: MasterType;
  /** Nama model untuk AuditLog dan pesan error. */
  entityType: string;
  label: string;
  createSchema: z.ZodObject;
  updateSchema: z.ZodObject;
  /** Hanya Vendor yang punya kolom version di F1. */
  hasVersion: boolean;
  list: (tx: Tx, filters: MasterFilters) => Promise<unknown[]>;
  create: (tx: Tx, values: Record<string, unknown>) => Promise<unknown>;
  /** Mengembalikan null bila tidak ada baris atau version tidak cocok. */
  update: (
    tx: Tx,
    id: string,
    values: Record<string, unknown>,
    version?: number,
  ) => Promise<MasterUpdate | null>;
  remove: (tx: Tx, id: string) => Promise<void>;
  isUsed: (tx: Tx, id: string) => Promise<boolean>;
};

/** Skema Zod sudah memvalidasi nama field; cast hanya untuk tipe input Prisma. */
export function toInput<T>(values: Record<string, unknown>): T {
  return values as T;
}

export function contains(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed
    ? { contains: trimmed, mode: "insensitive" as const }
    : undefined;
}

export function activeFilter(filters: MasterFilters) {
  return filters.active === undefined ? {} : { isActive: filters.active };
}

const LOCATION_DEFINITIONS: Partial<Record<MasterType, MasterDefinition>> = {
  regions: {
    type: "regions",
    entityType: "Region",
    label: "Region",
    createSchema: regionSchema,
    updateSchema: regionUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.region.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { _count: { select: { wilayah: true } } },
      }),
    create: (tx, values) =>
      tx.region.create({
        data: toInput<Prisma.RegionUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.region.findUnique({ where: { id } });
      const result = await tx.region.updateMany({
        where: { id },
        data: toInput<Prisma.RegionUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.region.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.region.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.wilayah.count({ where: { regionId: id } })) > 0,
  },

  wilayah: {
    type: "wilayah",
    entityType: "Wilayah",
    label: "Wilayah",
    createSchema: wilayahSchema,
    updateSchema: wilayahUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.wilayah.findMany({
        where: {
          ...activeFilter(filters),
          name: contains(filters.q),
          regionId: filters.regionId,
        },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { region: { select: { code: true, name: true, ops: true } } },
      }),
    create: (tx, values) =>
      tx.wilayah.create({
        data: toInput<Prisma.WilayahUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.wilayah.findUnique({ where: { id } });
      const result = await tx.wilayah.updateMany({
        where: { id },
        data: toInput<Prisma.WilayahUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.wilayah.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.wilayah.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.estate.count({ where: { wilayahId: id } })) > 0,
  },

  companies: {
    type: "companies",
    entityType: "Company",
    label: "Company",
    createSchema: companySchema,
    updateSchema: companyUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.company.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { _count: { select: { estates: true } } },
      }),
    create: (tx, values) =>
      tx.company.create({
        data: toInput<Prisma.CompanyUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.company.findUnique({ where: { id } });
      const result = await tx.company.updateMany({
        where: { id },
        data: toInput<Prisma.CompanyUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.company.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.company.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.estate.count({ where: { companyId: id } })) > 0 ||
      (await tx.project.count({ where: { companyId: id } })) > 0,
  },

  estates: {
    type: "estates",
    entityType: "Estate",
    label: "Estate",
    createSchema: estateSchema,
    updateSchema: estateUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.estate.findMany({
        where: {
          ...activeFilter(filters),
          name: contains(filters.q),
          companyId: filters.companyId,
          wilayahId: filters.wilayahId,
          wilayah: filters.regionId
            ? { regionId: filters.regionId }
            : undefined,
        },
        orderBy: [{ order: "asc" }, { code: "asc" }],
        include: {
          company: { select: { code: true, name: true } },
          wilayah: {
            select: {
              name: true,
              region: { select: { code: true, name: true, ops: true } },
            },
          },
        },
      }),
    create: (tx, values) =>
      tx.estate.create({
        data: toInput<Prisma.EstateUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.estate.findUnique({ where: { id } });
      const result = await tx.estate.updateMany({
        where: { id },
        data: toInput<Prisma.EstateUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.estate.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.estate.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.projectEstate.count({ where: { estateId: id } })) > 0 ||
      (await tx.block.count({ where: { estateId: id } })) > 0,
  },

  blocks: {
    type: "blocks",
    entityType: "Block",
    label: "Block",
    createSchema: blockSchema,
    updateSchema: blockUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.block.findMany({
        where: {
          ...activeFilter(filters),
          name: contains(filters.q),
          estateId: filters.estateId,
        },
        orderBy: { blockCode: "asc" },
        include: { estate: { select: { code: true, name: true } } },
      }),
    create: (tx, values) => {
      const { areaHectares, ...rest } = values;
      return tx.block.create({
        data: {
          ...toInput<Omit<Prisma.BlockUncheckedCreateInput, "areaHectares">>(
            rest,
          ),
          areaHectares:
            typeof areaHectares === "string"
              ? new Prisma.Decimal(areaHectares)
              : (areaHectares as number | null | undefined),
        },
      });
    },
    update: async (tx, id, values) => {
      const before = await tx.block.findUnique({ where: { id } });
      const result = await tx.block.updateMany({
        where: { id },
        data: toInput<Prisma.BlockUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.block.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.block.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.projectEstate.count({ where: { blockId: id } })) > 0,
  },
};

/** Kumpulan kedua dirangkai di sini; tiap file hanya menangani sebagian tipe. */
export const MASTER_DEFINITIONS = {
  ...LOCATION_DEFINITIONS,
  ...CATALOG_DEFINITIONS,
} as Record<MasterType, MasterDefinition>;

/** Dipanggil setelah `isMasterType` lolos; tipe yang tidak terdaftar harusnya mustahil. */
export function masterDefinition(type: MasterType): MasterDefinition {
  const definition = (MASTER_DEFINITIONS as Record<string, MasterDefinition>)[
    type
  ];
  if (!definition)
    throw new DomainError("NOT_FOUND", "Jenis master tidak dikenal.");
  return definition;
}
