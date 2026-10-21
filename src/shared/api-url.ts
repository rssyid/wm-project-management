import { headers } from "next/headers";

// fetch dengan URL relatif gagal di runtime server Node (ERR_INVALID_URL), wajib mutlak.
// Origin diambil dari permintaan saat ini (berbeda per port/env, tidak pakai env statis).
export async function apiUrl(path: string): Promise<string> {
  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost:3000";
  return `${proto}://${host}${path}`;
}

/** Header Cookie dari permintaan saat ini, untuk dibawa fetch server-side ke API
 * milik sendiri sehingga cookie session Better Auth ikut terkirim (undici tidak
 * mengirim cookie otomatis meski `credentials: "include"`). */
export async function sessionCookieHeaders(): Promise<HeadersInit> {
  const headersList = await headers();
  const cookie = headersList.get("cookie");
  return cookie ? { cookie } : {};
}
