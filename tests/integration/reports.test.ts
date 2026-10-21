import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { GET as reportsRoute } from "@/app/api/reports/[type]/route";

type Envelope = {
  data?: unknown;
  error?: { code: string; message: string };
};

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

describe("AC-57, AC-58 Laporan dan ekspor", () => {
  let cookie: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
  });

  const reportTypes = [
    "portfolio",
    "project-detail",
    "work-packages",
    "ews-red",
  ];

  for (const type of reportTypes) {
    it(`mengembalikan JSON untuk laporan ${type}`, async () => {
      const response = await callRoute(reportsRoute, {
        cookie,
        params: { type },
        path: `/api/reports/${type}?format=json`,
      });
      expect(response.status).toBe(200);
      const body: Envelope = await readJson(response);
      expect(body.data).toBeDefined();
    });

    it(`mengembalikan Xlsx untuk laporan ${type}`, async () => {
      const response = await callRoute(reportsRoute, {
        cookie,
        params: { type },
        path: `/api/reports/${type}?format=xlsx`,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("spreadsheetml");
    });

    it(`mengembalikan PDF untuk laporan ${type}`, async () => {
      const response = await callRoute(reportsRoute, {
        cookie,
        params: { type },
        path: `/api/reports/${type}?format=pdf`,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("pdf");
    });
  }

  it("menolak jenis laporan yang tidak dikenal", async () => {
    const response = await callRoute(reportsRoute, {
      cookie,
      params: { type: "invalid-type" },
      path: "/api/reports/invalid-type?format=json",
    });
    expect(response.status).toBe(400);
  });
});
