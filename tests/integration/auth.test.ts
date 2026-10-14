import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { toSessionUser } from "@/infra/session";

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
});
