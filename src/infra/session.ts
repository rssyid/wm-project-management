import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/infra/auth";
import { isRole, type Role } from "@/shared/role";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
};

/** Bentuk user yang dikembalikan Better Auth; field tambahan dideklarasikan di auth.ts. */
type RawUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  isActive?: boolean | null;
  mustChangePassword?: boolean | null;
};

/** Satu tempat memetakan user Better Auth ke tipe aplikasi; null bila role tidak dikenal. */
export function toSessionUser(raw: RawUser): SessionUser | null {
  if (!isRole(raw.role)) return null;
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    isActive: raw.isActive ?? true,
    mustChangePassword: raw.mustChangePassword ?? true,
  };
}

/**
 * docs/02 §4 dan §7: setiap halaman dan endpoint memvalidasi session sendiri; `proxy.ts`
 * hanya optimasi redirect. Satu tempat untuk membaca session supaya tipenya konsisten.
 */
export async function sessionUserFromHeaders(
  headers: Headers,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  return toSessionUser(session.user);
}

/** Untuk Server Component; route handler memakai sessionUserFromHeaders dengan request-nya. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  return sessionUserFromHeaders(await headers());
});
