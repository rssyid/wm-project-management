import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { toSessionUser } from "@/infra/session";

import { POST as authRoute } from "@/app/api/auth/[...all]/route";

import { callRoute } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

async function signIn(email: string, password: string) {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return { response, cookie };
}

/**
 * Better Auth hanya memvalidasi origin bila request membawa header `cookie`
 * (origin-check.mjs:108), yaitu kondisi browser sebenarnya. Karena itu tes memakai route
 * HTTP dengan header `origin` dan cookie, bukan pemanggilan API langsung.
 */
async function signInFromOrigin(
  email: string,
  password: string,
  origin: string,
) {
  return callRoute(authRoute, {
    method: "POST",
    path: "/api/auth/sign-in/email",
    body: { email, password },
    headers: { origin, cookie: "__vercel_live_token=uji" },
  });
}

async function sessionFromCookie(cookie: string) {
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  return session ? toSessionUser(session.user) : null;
}

describe("Better Auth email/password", () => {
  beforeAll(async () => {
    await ensureSeed();
  });

  it("memberikan session untuk email dan password yang benar", async () => {
    const user = await createUser({ role: "WM_HO_SPECIALIST" });

    const { response, cookie } = await signIn(user.email, user.password);
    expect(response.status).toBe(200);

    const session = await sessionFromCookie(cookie);
    expect(session?.id).toBe(user.id);
    expect(session?.role).toBe("WM_HO_SPECIALIST");
  });

  it("menolak password yang salah", async () => {
    const user = await createUser();

    const { response, cookie } = await signIn(user.email, "PasswordLain123!");
    expect(response.status).toBe(401);
    expect(cookie).toBe("");
  });

  it("AC-04 user nonaktif tidak mendapat session", async () => {
    const user = await createUser({ isActive: false });

    const { cookie } = await signIn(user.email, user.password);
    expect(await sessionFromCookie(cookie)).toBeNull();
  });

  it("menolak pendaftaran mandiri", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: `baru-${crypto.randomUUID()}@test.local`,
          password: "Password123!",
          name: "Baru",
        },
      }),
    ).rejects.toThrow(/sign up is not enabled/i);
  });

  it("session expired dibaca sebagai tanpa session", async () => {
    const user = await createUser();
    const { cookie } = await signIn(user.email, user.password);
    expect(await sessionFromCookie(cookie)).not.toBeNull();

    await prisma.session.deleteMany({ where: { userId: user.id } });
    expect(await sessionFromCookie(cookie)).toBeNull();
  });

  // Deploy pertama di Vercel menolak semua sign-in dengan 403 karena origin produksi dan
  // preview tidak ada di trustedOrigins (D-47).
  it("menerima sign-in dari origin produksi dan preview Vercel", async () => {
    for (const origin of [
      "https://wm-project-management.vercel.app",
      "https://wm-project-management-abc123-xyz.vercel.app",
    ]) {
      const user = await createUser();
      const response = await signInFromOrigin(
        user.email,
        user.password,
        origin,
      );
      expect(response.status, `origin ${origin}`).toBe(200);
      expect(response.headers.getSetCookie().join(";")).toContain(
        "better-auth.session_token",
      );
    }
  });

  it("menolak sign-in dari origin asing dengan 403", async () => {
    const user = await createUser();

    const response = await signInFromOrigin(
      user.email,
      user.password,
      "https://evil.example",
    );
    expect(response.status).toBe(403);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
