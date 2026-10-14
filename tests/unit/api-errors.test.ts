import { describe, expect, it } from "vitest";
import { z } from "zod";

import { DomainError, ERROR_STATUS, type ErrorCode } from "@/shared/errors";
import { ACTIONS, assertCan, can } from "@/shared/permissions";
import type { Role } from "@/shared/role";
import { toErrorResponse } from "@/app/api/_lib/respond";

const ROLES: Role[] = ["SUPER_ADMIN", "WM_HO_SPECIALIST", "MANAGEMENT_VIEWER"];

describe("matriks permission", () => {
  it("semua role boleh membaca", () => {
    for (const role of ROLES) {
      expect(can(role, "read")).toBe(true);
    }
  });

  it("viewer tidak boleh melakukan mutasi apa pun", () => {
    const mutations = ACTIONS.filter((action) => action !== "read");
    for (const action of mutations) {
      expect(can("MANAGEMENT_VIEWER", action)).toBe(false);
      expect(() =>
        assertCan({ role: "MANAGEMENT_VIEWER" }, action),
      ).toThrowError(/tidak berhak/);
    }
  });

  it("AC-03 specialist boleh master dan file, tidak boleh kelola user", () => {
    expect(can("WM_HO_SPECIALIST", "master.write")).toBe(true);
    expect(can("WM_HO_SPECIALIST", "file.write")).toBe(true);
    expect(can("WM_HO_SPECIALIST", "user.manage")).toBe(false);
  });

  it("super admin boleh semua aksi yang terdaftar", () => {
    for (const action of ACTIONS) {
      expect(can("SUPER_ADMIN", action)).toBe(true);
    }
  });

  it("tanpa user menghasilkan 401, bukan 403", () => {
    expect(() => assertCan(null, "read")).toThrowError(DomainError);
    try {
      assertCan(null, "read");
    } catch (error) {
      expect((error as DomainError).code).toBe("UNAUTHENTICATED");
    }
  });
});

describe("pemetaan error ke HTTP", () => {
  it("AC-06 gate dan prasyarat dipetakan 409, bukan 403", () => {
    const gateCodes: ErrorCode[] = [
      "INVALID_TRANSITION",
      "PRECONDITION_FAILED",
      "PROJECT_LOCKED",
      "FIELD_INPUT_LOCKED",
      "WEIGHT_MISMATCH",
      "DUPLICATE",
      "ACTIVE_CONFLICT",
      "VERSION_CONFLICT",
      "IN_USE",
    ];
    for (const code of gateCodes) {
      expect(ERROR_STATUS[code]).toBe(409);
    }
    expect(ERROR_STATUS.FORBIDDEN_ROLE).toBe(403);
    expect(ERROR_STATUS.FILE_TOO_LARGE).toBe(413);
  });

  it("domain error jadi envelope dengan kode dan pesan Indonesia", async () => {
    const response = toErrorResponse(
      new DomainError("IN_USE", "Vendor sudah dipakai dan tidak bisa dihapus."),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "IN_USE",
        message: "Vendor sudah dipakai dan tidak bisa dihapus.",
      },
    });
  });

  it("Zod error jadi 400 dengan daftar field", async () => {
    const schema = z.object({ name: z.string().min(1, "Wajib diisi") });
    const parsed = schema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);

    const response = toErrorResponse(parsed.error);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Periksa kembali isian yang ditandai.",
        fields: { name: "Wajib diisi" },
      },
    });
  });

  it("Prisma unique dan not found dipetakan ke kode dokumen", async () => {
    const duplicate = toErrorResponse(
      Object.assign(new Error("x"), { code: "P2002" }),
    );
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: { code: "DUPLICATE" },
    });

    const missing = toErrorResponse(
      Object.assign(new Error("x"), { code: "P2025" }),
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("error tak terduga jadi 500 tanpa membocorkan detail", async () => {
    const response = toErrorResponse(new Error("rahasia internal"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });
});
