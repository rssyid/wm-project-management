import type { MasterFilters } from "@/domain/master/registry";
import type { MasterListItem, OptionItem } from "@/app/(app)/master/row";
import type { MasterType } from "@/shared/location";
import { z } from "zod";

import {
  approvalPositionSchema,
  approvalPositionUpdateSchema,
  blockSchema,
  blockUpdateSchema,
  companySchema,
  companyUpdateSchema,
  estateSchema,
  estateUpdateSchema,
  heavyEquipmentTypeSchema,
  heavyEquipmentTypeUpdateSchema,
  materialSchema,
  materialUpdateSchema,
  projectCategorySchema,
  projectCategoryUpdateSchema,
  regionSchema,
  regionUpdateSchema,
  unitSchema,
  unitUpdateSchema,
  vendorSchema,
  vendorUpdateSchema,
  wilayahSchema,
  wilayahUpdateSchema,
} from "@/shared/schemas/master";

export type MasterSchemas = {
  create: z.ZodObject;
  update: z.ZodObject;
};

export const MASTER_SCHEMAS: Record<MasterType, MasterSchemas> = {
  regions: { create: regionSchema, update: regionUpdateSchema },
  wilayah: { create: wilayahSchema, update: wilayahUpdateSchema },
  companies: { create: companySchema, update: companyUpdateSchema },
  estates: { create: estateSchema, update: estateUpdateSchema },
  blocks: { create: blockSchema, update: blockUpdateSchema },
  vendors: { create: vendorSchema, update: vendorUpdateSchema },
  units: { create: unitSchema, update: unitUpdateSchema },
  "project-categories": {
    create: projectCategorySchema,
    update: projectCategoryUpdateSchema,
  },
  materials: { create: materialSchema, update: materialUpdateSchema },
  "heavy-equipment-types": {
    create: heavyEquipmentTypeSchema,
    update: heavyEquipmentTypeUpdateSchema,
  },
  "approval-positions": {
    create: approvalPositionSchema,
    update: approvalPositionUpdateSchema,
  },
};

export type MasterViewProps = {
  type: MasterType;
  label: string;
  rows: MasterListItem[];
  options: Record<string, OptionItem[]>;
  hasVersion: boolean;
  canWrite: boolean;
  filters: MasterFilters;
};
