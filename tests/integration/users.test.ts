import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { toSessionUser } from "@/infra/session";

import {
  GET as listUsersRoute,
  POST as createUserRoute,
} from "@/app/api/users/route";
import { PATCH as updateUserRoute } from "@/app/api/users/[id]/route";
import { POST as resetPasswordRoute } from "@/app/api/users/[id]/reset-password/route";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

async function signIn(email: string, password: string): Promise<string> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
}

describe("API user (Super Admin)", () => {
  let adminCookie: string;
  let adminId: string;
  let specialistCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    await ensureSeed();
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    adminId = admin.id;
    adminCookie = await signIn(admin.email, admin.password);
    specialistCookie = await signIn(specialist.email, specialist.password);
    viewerCookie = await signIn(viewer.email, viewer.password);
  });

  it("AC-03 specialist dan viewer tidak boleh mengelola user", async () => {
    for (const cookie of [specialistCookie, viewerCookie]) {
      const list = await callRoute(listUsersRoute, {
        cookie,
        path: "/api/users",
      });
      expect(list.status).toBe(403);

      const created = await callRoute(createUserRoute, {
        cookie,
        method: "POST",
        path: "/api/users",
        body: {
          email: "larangan@wm.test",
          name: "Tidak Boleh",
          role: "MANAGEMENT_VIEWER",
          temporaryPassword: "Password123!",
        },
      });
      expect(created.status).toBe(403);
    }
    await expect(
      prisma.user.count({ where: { email: "larangan@wm.test" } }),
    ).resolves.toBe(0);
  });

  it("super admin membuat user dengan password sementara dan audit tercatat", async () => {
    const response = await callRoute(createUserRoute, {
      cookie: adminCookie,
      method: "POST",
      path: "/api/users",
      body: {
        email: "Operator.Baru@wm.test",
        name: "Operator Baru",
        role: "WM_HO_SPECIALIST",
        temporaryPassword: "PasswordSemnatak123!",
      },
    });
    expect(response.status).toBe(200);
    const { data: created } = await readJson<{
      data: { id: string; email: string; mustChangePassword: boolean };
    }>(response);
    expect(created.email).toBe("operator.baru@wm.test");
    expect(created.mustChangePassword).toBe(true);

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: created.id, providerId: "credential" },
    });
    expect(account.password).toBeTruthy();

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: "User", entityId: created.id, action: "CREATE" },
    });
    expect(log.actorId).toBe(adminId);
  });

  it("email ganda menjawab 409 DUPLICATE", async () => {
    const response = await callRoute(createUserRoute, {
      cookie: adminCookie,
      method: "POST",
      path: "/api/users",
      body: {
        email: "operator.baru@wm.test",
        name: "Kembar",
        role: "MANAGEMENT_VIEWER",
        temporaryPassword: "Password123!",
      },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DUPLICATE" },
    });
  });

  it("menonaktifkan user langsung mencabut session-nya", async () => {
    const target = await createUser({ role: "WM_HO_SPECIALIST" });
    const cookie = await signIn(target.email, target.password);
    const before = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(toSessionUser(before!.user)?.id).toBe(target.id);

    const response = await callRoute(updateUserRoute, {
      cookie: adminCookie,
      method: "PATCH",
      path: `/api/users/${target.id}`,
      body: { isActive: false },
      params: { id: target.id },
    });
    expect(response.status).toBe(200);

    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(
      0,
    );
    const after = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(after).toBeNull();

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: "DEACTIVATE" },
    });
    expect(log.after).toMatchObject({ isActive: false });
  });

  it("super admin tidak bisa menonaktifkan akunnya sendiri", async () => {
    const response = await callRoute(updateUserRoute, {
      cookie: adminCookie,
      method: "PATCH",
      path: `/api/users/${adminId}`,
      body: { isActive: false },
      params: { id: adminId },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PRECONDITION_FAILED" },
    });
  });

  it("AC-04 reset password mengganti password dan mencabut semua session", async () => {
    const target = await createUser({ role: "WM_HO_SPECIALIST" });
    const oldCookie = await signIn(target.email, target.password);

    const response = await callRoute(resetPasswordRoute, {
      cookie: adminCookie,
      method: "POST",
      path: `/api/users/${target.id}/reset-password`,
      body: { temporaryPassword: "PasswordBARU456!" },
      params: { id: target.id },
    });
    expect(response.status).toBe(200);

    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(
      0,
    );
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: oldCookie }),
      }),
    ).toBeNull();

    const oldPassword = await auth.api.signInEmail({
      body: { email: target.email, password: target.password },
      asResponse: true,
    });
    expect(oldPassword.status).toBe(401);

    const newCookie = await signIn(target.email, "PasswordBARU456!");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: newCookie }),
    });
    expect(toSessionUser(session!.user)?.mustChangePassword).toBe(true);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: "RESET_PASSWORD" },
    });
    expect(log.actorId).toBe(adminId);
  });
});
