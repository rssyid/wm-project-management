import { z } from "zod";

import { assertCan, type Action } from "@/shared/permissions";
import { DomainError } from "@/shared/errors";
import { sessionUserFromHeaders, type SessionUser } from "@/infra/session";

/** docs/04 §1: tanpa session selalu 401, apa pun ruta dan metodenya. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await sessionUserFromHeaders(request.headers);
  if (!user) {
    throw new DomainError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
  }
  return user;
}

export async function requirePermission(
  request: Request,
  action: Action,
): Promise<SessionUser> {
  const user = await requireUser(request);
  assertCan(user, action);
  return user;
}

/** Body JSON divalidasi skema Zod yang sama dengan sisi klien (docs/02 §1). */
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  return schema.parse(await readJsonObject(request));
}

/**
 * Objek mentah tanpa validasi. Dipakai saat route perlu tahu field mana yang benar-benar
 * dikirim klien (mis. memisahkan aksi nonaktifkan dari perubahan biasa).
 */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new DomainError("VALIDATION_ERROR", "Body harus berupa JSON.");
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new DomainError("VALIDATION_ERROR", "Body harus berupa objek JSON.");
  }
  return payload as Record<string, unknown>;
}
