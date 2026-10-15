import { connection } from "next/server";

import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { listProjects } from "@/domain/project/queries";
import { createProject } from "@/domain/project/service";
import {
  createProjectSchema,
  projectFiltersSchema,
} from "@/shared/schemas/project";

export async function GET(request: Request) {
  try {
    // Daftar proyek bergantung pada session, jadi route dijalankan per permintaan.
    await connection();
    await requirePermission(request, "read");
    const filters = projectFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { data, total } = await listProjects(filters);
    return ok(data, {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, "project.write");
    const input = await parseJson(request, createProjectSchema);
    return ok(await createProject(input, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
