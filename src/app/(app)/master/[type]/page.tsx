import { notFound } from "next/navigation";

import { MasterView } from "@/components/master/master-view";
import { masterDefinition } from "@/domain/master/registry";
import { listMaster } from "@/domain/master/service";
import { prisma } from "@/infra/db";
import { getSessionUser } from "@/infra/session";
import { isMasterType } from "@/shared/location";
import { can } from "@/shared/permissions";

import { MASTER_LABEL } from "../master-config";
import type { MasterListItem, OptionItem } from "../row";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export default async function MasterTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: SearchParams;
}) {
  const { type } = await params;
  if (!isMasterType(type)) notFound();

  const query = await searchParams;
  const activeParam = single(query.active);
  const filters = {
    q: single(query.q),
    active:
      activeParam === "true"
        ? true
        : activeParam === "false"
          ? false
          : undefined,
    regionId: single(query.regionId),
    companyId: single(query.companyId),
    wilayahId: single(query.wilayahId),
    estateId: single(query.estateId),
  };

  const user = await getSessionUser();
  const rows = (await listMaster(type, filters)) as MasterListItem[];
  const definition = masterDefinition(type);

  return (
    <MasterView
      type={type}
      label={MASTER_LABEL[type]}
      rows={rows}
      options={await loadOptions(type)}
      hasVersion={definition.hasVersion}
      canWrite={can(user?.role ?? "MANAGEMENT_VIEWER", "master.write")}
      filters={filters}
    />
  );
}

/** Opsi dropdown hanya dimuat untuk master yang benar-benar memakainya. */
async function loadOptions(
  type: string,
): Promise<Record<string, OptionItem[]>> {
  if (type === "wilayah") {
    return { regions: await activeRegions() };
  }
  if (type === "estates") {
    return {
      companies: await activeCompanies(),
      wilayah: await activeWilayah(),
      regions: await activeRegions(),
    };
  }
  if (type === "blocks") {
    return { estates: await activeEstates() };
  }
  if (type === "materials") {
    return {
      units: await prisma.unit.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    };
  }
  return {};
}

async function activeRegions(): Promise<OptionItem[]> {
  return prisma.region.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function activeCompanies(): Promise<OptionItem[]> {
  return prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function activeWilayah(): Promise<OptionItem[]> {
  return prisma.wilayah.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function activeEstates(): Promise<OptionItem[]> {
  return prisma.estate.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true },
  });
}
