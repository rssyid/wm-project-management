import {
  deleteMaster,
  setMasterActive,
  updateMaster,
} from "@/domain/master/service";
import { masterDefinition } from "@/domain/master/registry";
import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { readJsonObject, requirePermission } from "@/app/api/_lib/session";
import { DomainError } from "@/shared/errors";

import { parseMasterType, parseVersion } from "../../_lib/query";

type Context = { params: Promise<{ type: string; id: string }> };

async function resolve(context: Context) {
  const { type, id } = await context.params;
  const masterType = parseMasterType(type);
  if (!masterType)
    throw new DomainError("NOT_FOUND", "Jenis master tidak dikenal.");
  return { masterType, id, definition: masterDefinition(masterType) };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "master.write");
    const { masterType, id, definition } = await resolve(context);
    const raw = await readJsonObject(request);

    // Nonaktifkan/aktifkan dikirim sebagai satu-satunya field, jadi dicek pada body mentah
    // sebelum skema menambahkan nilai default field lain.
    const keys = Object.keys(raw);
    if (keys.length === 1 && keys[0] === "isActive") {
      const { isActive } = definition.updateSchema.parse(raw);
      if (typeof isActive !== "boolean") {
        throw new DomainError(
          "VALIDATION_ERROR",
          "Status aktif harus true atau false.",
        );
      }
      return ok(await setMasterActive(masterType, id, isActive, user.id));
    }

    const body = definition.updateSchema.parse(raw);
    const version = parseVersion(
      new URL(request.url).searchParams.get("version"),
    );
    return ok(await updateMaster(masterType, id, body, version, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "master.write");
    const { masterType, id } = await resolve(context);
    await deleteMaster(masterType, id, user.id);
    return ok({ id, deleted: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
