import { Prisma } from "@/generated/prisma/client";
import type { MasterType } from "@/shared/location";
import {
  approvalPositionSchema,
  approvalPositionUpdateSchema,
  heavyEquipmentTypeSchema,
  heavyEquipmentTypeUpdateSchema,
  materialSchema,
  materialUpdateSchema,
  projectCategorySchema,
  projectCategoryUpdateSchema,
  unitSchema,
  unitUpdateSchema,
  vendorSchema,
  vendorUpdateSchema,
} from "@/shared/schemas/master";

import {
  activeFilter,
  contains,
  toInput,
  type MasterDefinition,
} from "./registry";

/** Katalog, satuan, jabatan, dan material (docs/04 §2). */
export const CATALOG_DEFINITIONS: Partial<
  Record<MasterType, MasterDefinition>
> = {
  vendors: {
    type: "vendors",
    entityType: "Vendor",
    label: "Vendor",
    createSchema: vendorSchema,
    updateSchema: vendorUpdateSchema,
    hasVersion: true,
    list: (tx, filters) =>
      tx.vendor.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: { name: "asc" },
        include: { _count: { select: { spks: true, workPackages: true } } },
      }),
    create: (tx, values) =>
      tx.vendor.create({
        data: toInput<Prisma.VendorUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values, version) => {
      const before = await tx.vendor.findUnique({ where: { id } });
      const result = await tx.vendor.updateMany({
        where: version === undefined ? { id } : { id, version },
        data: {
          ...toInput<Omit<Prisma.VendorUncheckedUpdateInput, "version">>(
            values,
          ),
          version: { increment: 1 },
        },
      });
      if (result.count === 0) return null;
      return { before, after: await tx.vendor.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.vendor.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.spk.count({ where: { vendorId: id } })) > 0 ||
      (await tx.tenderAttempt.count({ where: { winnerVendorId: id } })) > 0 ||
      (await tx.workPackage.count({ where: { vendorId: id } })) > 0 ||
      (await tx.purchaseOrder.count({ where: { vendorId: id } })) > 0,
  },

  units: {
    type: "units",
    entityType: "Unit",
    label: "Satuan",
    createSchema: unitSchema,
    updateSchema: unitUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.unit.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: { name: "asc" },
      }),
    create: (tx, values) =>
      tx.unit.create({
        data: toInput<Prisma.UnitUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.unit.findUnique({ where: { id } });
      const result = await tx.unit.updateMany({
        where: { id },
        data: toInput<Prisma.UnitUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.unit.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.unit.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.material.count({ where: { defaultUnitId: id } })) > 0 ||
      (await tx.workPackageItem.count({ where: { unitId: id } })) > 0,
  },

  "project-categories": {
    type: "project-categories",
    entityType: "ProjectCategory",
    label: "Kategori proyek",
    createSchema: projectCategorySchema,
    updateSchema: projectCategoryUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.projectCategory.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { _count: { select: { projects: true } } },
      }),
    create: (tx, values) =>
      tx.projectCategory.create({
        data: toInput<Prisma.ProjectCategoryUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.projectCategory.findUnique({ where: { id } });
      const result = await tx.projectCategory.updateMany({
        where: { id },
        data: toInput<Prisma.ProjectCategoryUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return {
        before,
        after: await tx.projectCategory.findUnique({ where: { id } }),
      };
    },
    remove: async (tx, id) => {
      await tx.projectCategory.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.project.count({ where: { categoryId: id } })) > 0,
  },

  materials: {
    type: "materials",
    entityType: "Material",
    label: "Material",
    createSchema: materialSchema,
    updateSchema: materialUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.material.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: { name: "asc" },
        include: { defaultUnit: { select: { code: true, name: true } } },
      }),
    create: (tx, values) =>
      tx.material.create({
        data: toInput<Prisma.MaterialUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.material.findUnique({ where: { id } });
      const result = await tx.material.updateMany({
        where: { id },
        data: toInput<Prisma.MaterialUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return { before, after: await tx.material.findUnique({ where: { id } }) };
    },
    remove: async (tx, id) => {
      await tx.material.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.workPackageItem.count({ where: { materialId: id } })) > 0,
  },

  "heavy-equipment-types": {
    type: "heavy-equipment-types",
    entityType: "HeavyEquipmentType",
    label: "Jenis alat berat",
    createSchema: heavyEquipmentTypeSchema,
    updateSchema: heavyEquipmentTypeUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.heavyEquipmentType.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: { name: "asc" },
      }),
    create: (tx, values) =>
      tx.heavyEquipmentType.create({
        data: toInput<Prisma.HeavyEquipmentTypeUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.heavyEquipmentType.findUnique({ where: { id } });
      const result = await tx.heavyEquipmentType.updateMany({
        where: { id },
        data: toInput<Prisma.HeavyEquipmentTypeUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return {
        before,
        after: await tx.heavyEquipmentType.findUnique({ where: { id } }),
      };
    },
    remove: async (tx, id) => {
      await tx.heavyEquipmentType.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.heavyEquipmentUsage.count({
        where: { heavyEquipmentTypeId: id },
      })) > 0,
  },

  "approval-positions": {
    type: "approval-positions",
    entityType: "ApprovalPosition",
    label: "Jabatan approver",
    createSchema: approvalPositionSchema,
    updateSchema: approvalPositionUpdateSchema,
    hasVersion: false,
    list: (tx, filters) =>
      tx.approvalPosition.findMany({
        where: { ...activeFilter(filters), name: contains(filters.q) },
        orderBy: { rank: "asc" },
      }),
    create: (tx, values) =>
      tx.approvalPosition.create({
        data: toInput<Prisma.ApprovalPositionUncheckedCreateInput>(values),
      }),
    update: async (tx, id, values) => {
      const before = await tx.approvalPosition.findUnique({ where: { id } });
      const result = await tx.approvalPosition.updateMany({
        where: { id },
        data: toInput<Prisma.ApprovalPositionUncheckedUpdateInput>(values),
      });
      if (result.count === 0) return null;
      return {
        before,
        after: await tx.approvalPosition.findUnique({ where: { id } }),
      };
    },
    remove: async (tx, id) => {
      await tx.approvalPosition.delete({ where: { id } });
    },
    isUsed: async (tx, id) =>
      (await tx.approvalMatrixTierLevel.count({ where: { positionId: id } })) >
        0 ||
      (await tx.approvalLevelSnapshot.count({ where: { positionId: id } })) > 0,
  },
};
