import { listMaster } from "@/domain/master/service";
import { createMaster } from "@/domain/master/service";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { parseJson, requirePermission } from "@/app/api/_lib/session";
import { masterDefinition } from "@/domain/master/registry";
import { DomainError } from "@/shared/errors";

import { parseMasterFilters, parseMasterType } from "../_lib/query";

type Context = { params: Promise<{ type: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { type } = await context.params;
    const masterType = parseMasterType(type);
    if (!masterType) {
      throw new DomainError("NOT_FOUND", "Jenis master tidak dikenal.");
    }
    const rows = await listMaster(
      masterType,
      parseMasterFilters(new URL(request.url)),
    );
    return ok(rows, { page: 1, pageSize: rows.length, total: rows.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "master.write");
    const { type } = await context.params;
    const masterType = parseMasterType(type);
    if (!masterType) {
      throw new DomainError("NOT_FOUND", "Jenis master tidak dikenal.");
    }
    const definition = masterDefinition(masterType);
    const body = await parseJson(request, definition.createSchema);
    const created = await createMaster(masterType, body, user.id);
    return ok(created);
  } catch (error) {
    return toErrorResponse(error);
  }
}
