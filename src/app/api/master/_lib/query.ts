import type { MasterFilters } from "@/domain/master/registry";
import { isMasterType, type MasterType } from "@/shared/location";

export function parseMasterType(raw: string): MasterType | null {
  return isMasterType(raw) ? raw : null;
}

/** Query list master mengikuti docs/04 §2: `?active=&q=&regionId=&companyId=&wilayahId=&estateId=`. */
export function parseMasterFilters(url: URL): MasterFilters {
  const params = url.searchParams;
  const filters: MasterFilters = {};

  const active = params.get("active");
  if (active === "true" || active === "false")
    filters.active = active === "true";

  const q = params.get("q");
  if (q) filters.q = q;

  for (const key of [
    "regionId",
    "companyId",
    "wilayahId",
    "estateId",
  ] as const) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }

  return filters;
}

export function parseVersion(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) ? value : undefined;
}
