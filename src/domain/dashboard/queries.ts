// docs/04 §10: data dashboard dari API. UI tidak menghitung ulang progres/EWS.
import { projectFiltersSchema } from "@/shared/schemas/project";

export type DashboardData = {
  projectCount: number;
  averageProgress: string;
  byStatus: Record<string, number>;
  deviations: Array<{
    projectCode: string;
    projectName: string;
    deviationPct: number;
  }>;
  ews: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    level: string | null;
    label: string;
  }>;
  sCurve: Array<{
    week: string;
    planned: number;
    actual: number;
  }>;
};

export async function fetchDashboard(filters: {
  q?: string;
  status?: string | string[];
  companyIds?: string | string[];
  regionIds?: string | string[];
  categoryId?: string;
}): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  const statuses = Array.isArray(filters.status)
    ? filters.status
    : [filters.status].filter(Boolean);
  if (statuses.length) params.set("status", statuses.join(","));
  const ids = Array.isArray(filters.companyIds)
    ? filters.companyIds
    : [filters.companyIds].filter(Boolean);
  if (ids.length) params.set("companyId", ids.join(","));
  const regionIds = Array.isArray(filters.regionIds)
    ? filters.regionIds
    : [filters.regionIds].filter(Boolean);
  if (regionIds.length) params.set("regionId", regionIds.join(","));
  if (filters.categoryId) params.set("categoryId", filters.categoryId);

  const response = await fetch(`/api/dashboard?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Gagal memuat dashboard.");
  }
  const body = await response.json();
  return {
    projectCount: body.data?.projectCount ?? 0,
    averageProgress: body.data?.averageProgress ?? "0.00",
    byStatus: body.data?.byStatus ?? {},
    deviations: body.data?.deviations ?? [],
    ews: body.data?.ews ?? [],
    sCurve: body.data?.sCurve ?? [],
  };
}

// Validasi filter menggunakan skema yang sama dengan API.
export function validateDashboardFilters(input: unknown) {
  return projectFiltersSchema.parse(input);
}
