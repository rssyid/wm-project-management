// docs/04 §10: data dashboard dari API. UI tidak menghitung ulang progres/EWS.
import { getDashboardData } from "@/domain/dashboard/service";
import {
  projectFiltersSchema,
  type ProjectFilters,
} from "@/shared/schemas/project";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function fetchDashboard(
  filters: ProjectFilters,
): Promise<DashboardData> {
  return getDashboardData(filters);
}

// Validasi filter menggunakan skema yang sama dengan API.
export function validateDashboardFilters(input: unknown) {
  return projectFiltersSchema.parse(input);
}
