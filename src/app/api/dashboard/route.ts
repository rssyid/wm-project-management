import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { getDashboardData } from "@/domain/dashboard/service";
import { projectFiltersSchema } from "@/shared/schemas/project";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "read");
    const filters = projectFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return ok(await getDashboardData(filters));
  } catch (error) {
    return toErrorResponse(error);
  }
}
