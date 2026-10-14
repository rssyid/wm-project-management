import { auth } from "@/infra/auth";
import { GET as listRoute } from "@/app/api/master/[type]/route";

import { callRoute, readJson } from "./call-route";

/** Cookie session sungguhan dari Better Auth, dipakai untuk semua request uji. */
export async function signIn(email: string, password: string): Promise<string> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
}

export type MasterRow = { id: string; isActive: boolean };

/** Baca daftar master lewat route sungguhan, seperti yang dipakai UI. */
export async function listMasterRows<T = MasterRow>(
  cookie: string,
  type: string,
  filters: { active?: boolean; regionId?: string } = {},
): Promise<T[]> {
  const params = new URLSearchParams();
  if (filters.active !== undefined)
    params.set("active", String(filters.active));
  if (filters.regionId) params.set("regionId", filters.regionId);
  const response = await callRoute(listRoute, {
    cookie,
    path: `/api/master/${type}?${params.toString()}`,
    params: { type },
  });
  const body = await readJson<{ data: T[] }>(response);
  return body.data;
}
