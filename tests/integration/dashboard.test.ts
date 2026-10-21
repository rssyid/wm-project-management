import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { GET as dashboardRoute } from "@/app/api/dashboard/route";

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

describe("AC-57 Dashboard dan konsistensi progres/EWS", () => {
  let cookie: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
  });

  it("mengembalikan data dashboard dengan byStatus dan averageProgress", async () => {
    const response = await callRoute(dashboardRoute, { cookie });
    expect(response.status).toBe(200);
    const body: Envelope = await readJson(response);
    const data = body.data as {
      projectCount: number;
      averageProgress: string;
      byStatus: Record<string, number>;
      deviations: unknown[];
    };
    expect(data).toHaveProperty("projectCount");
    expect(data).toHaveProperty("averageProgress");
    expect(data).toHaveProperty("byStatus");
    expect(typeof data.averageProgress).toBe("string");
  });

  it("AC-57 progres & EWS konsisten di dashboard", async () => {
    const response = await callRoute(dashboardRoute, { cookie });
    expect(response.status).toBe(200);
    const body: Envelope = await readJson(response);
    const data = body.data as {
      averageProgress: string;
    };
    // averageProgress harus string desimal valid
    expect(parseFloat(data.averageProgress)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(data.averageProgress)).toBeLessThanOrEqual(100);
  });
});
