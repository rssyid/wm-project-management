import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";

import { callRoute, readJson } from "./helpers/call-route";
import { createUser, ensureSeed } from "./helpers/factory";

import { PATCH as updateTierRoute } from "@/app/api/approval-tiers/[id]/route";
import { GET as matchRoute } from "@/app/api/approval-tiers/match/route";
import {
  GET as listTiersRoute,
  POST as createTierRoute,
} from "@/app/api/approval-tiers/route";

type TierData = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
};
type Envelope = {
  data?: unknown;
  error?: { code: string; message: string; fields?: Record<string, string> };
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

describe("matriks approval", () => {
  let cookieAdmin: string;
  let cookieSpecialist: string;
  let userId: string;
  let positionIds: string[];
  let tierBawah: TierData;
  let tierAtas: TierData;

  beforeAll(async () => {
    await ensureSeed();
    const admin = await createUser({ role: "SUPER_ADMIN" });
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookieAdmin = await signIn(admin.email, admin.password);
    cookieSpecialist = await signIn(specialist.email, specialist.password);
    userId = admin.id;
    positionIds = (
      await prisma.approvalPosition.findMany({
        orderBy: { rank: "asc" },
        take: 3,
        select: { id: true },
      })
    ).map((position) => position.id);
  });

  async function postTier(body: Record<string, unknown> = {}) {
    const response = await callRoute(createTierRoute, {
      cookie: cookieAdmin,
      method: "POST",
      body: {
        name: "Tier uji",
        forAfce: true,
        forArSupplement: true,
        minAmount: "0",
        maxAmount: "500000000",
        positionIds: positionIds.slice(0, 2),
        ...body,
      },
    });
    return { response, json: await readJson<Envelope>(response) };
  }

  it("AC-03 Super Admin membuat tier dengan urutan jabatan berurutan", async () => {
    const { response, json } = await postTier({
      name: "Tier bawah",
      minAmount: "0",
      maxAmount: "500000000",
    });
    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      name: "Tier bawah",
      minAmount: "0.00",
      maxAmount: "500000000.00",
      levels: [
        { levelNo: 1, position: { id: positionIds[0] } },
        { levelNo: 2, position: { id: positionIds[1] } },
      ],
    });
    tierBawah = json.data as TierData;
  });

  it("AC-03 Specialist ditolak 403 saat mengelola matriks", async () => {
    const response = await callRoute(createTierRoute, {
      cookie: cookieSpecialist,
      method: "POST",
      body: {
        name: "Tier oleh specialist",
        forAfce: true,
        forArSupplement: false,
        minAmount: "0",
        maxAmount: "1000",
        positionIds: [positionIds[0]],
      },
    });
    expect(response.status).toBe(403);
    expect((await readJson<Envelope>(response)).error?.code).toBe(
      "FORBIDDEN_ROLE",
    );
  });

  it("rentang tier yang tumpang tindih ditolak", async () => {
    const { response, json } = await postTier({
      name: "Tier tumpang tindih",
      minAmount: "400000000",
      maxAmount: "600000000",
    });
    expect(response.status).toBe(400);
    expect(json.error?.message).toContain("tumpang tindih");
  });

  it("rentang tier yang berlubang ditolak", async () => {
    const { response, json } = await postTier({
      name: "Tier berlubang",
      minAmount: "700000000",
      maxAmount: null,
    });
    expect(response.status).toBe(400);
    expect(json.error?.message).toContain("tanpa tier");
  });

  it("jabatan yang sama tidak boleh dua kali dalam satu tier", async () => {
    const { response, json } = await postTier({
      name: "Tier jabatan ganda",
      minAmount: "800000000",
      maxAmount: "900000000",
      positionIds: [positionIds[0], positionIds[0]],
    });
    expect(response.status).toBe(400);
    expect(json.error?.fields?.positionIds).toContain(
      "Jabatan tidak boleh sama",
    );
  });

  it("AC-18 endpoint match memakai batas bawah inklusif dan batas atas eksklusif", async () => {
    const atas = await postTier({
      name: "Tier atas",
      minAmount: "500000000",
      maxAmount: "1000000000",
      positionIds: [positionIds[0]],
    });
    expect(atas.response.status).toBe(200);
    tierAtas = atas.json.data as TierData;

    const sebelumBatas = await readJson<Envelope>(
      await callRoute(matchRoute, {
        cookie: cookieSpecialist,
        path: "/api/approval-tiers/match?doc=AFCE&amount=499999999.99",
      }),
    );
    expect((sebelumBatas.data as TierData).name).toBe("Tier bawah");

    const tepatBatas = await readJson<Envelope>(
      await callRoute(matchRoute, {
        cookie: cookieSpecialist,
        path: "/api/approval-tiers/match?doc=AFCE&amount=500000000",
      }),
    );
    expect((tepatBatas.data as TierData).name).toBe("Tier atas");
  });

  it("mengubah tier menaikkan version dan menonaktifkan tier", async () => {
    const { json } = await postTier({
      name: "Tier sementara",
      minAmount: "1000000000",
      maxAmount: "1200000000",
      positionIds: [positionIds[0]],
    });
    const tier = json.data as TierData;
    expect(tier.version).toBe(1);

    const updated = await callRoute(updateTierRoute, {
      cookie: cookieAdmin,
      method: "PATCH",
      params: { id: tier.id },
      body: {
        version: 1,
        name: "Tier sementara",
        forAfce: true,
        forArSupplement: true,
        minAmount: "1000000000",
        maxAmount: "1200000000",
        positionIds: [positionIds[2]],
        isActive: false,
      },
    });
    expect(updated.status).toBe(200);
    expect((await readJson<Envelope>(updated)).data).toMatchObject({
      isActive: false,
      version: 2,
      levels: [{ levelNo: 1, position: { id: positionIds[2] } }],
    });
  });

  it("perubahan tier tidak mengubah snapshot level dokumen yang sudah ada", async () => {
    const { json } = await postTier({
      name: "Tier untuk snapshot",
      minAmount: "1000000000",
      maxAmount: "1300000000",
    });
    const tierId = (json.data as TierData).id;

    const project = await prisma.project.create({
      data: {
        code: `WM-TIER-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        name: "Proyek snapshot",
        companyId: (await prisma.company.findFirstOrThrow()).id,
        categoryId: (await prisma.projectCategory.findFirstOrThrow()).id,
        createdById: userId,
        status: "RAB_READY",
      },
      select: { id: true },
    });
    const attempt = await prisma.afceAttempt.create({
      data: {
        projectId: project.id,
        attemptNo: 1,
        status: "DRAFT",
        matrixTierId: tierId,
        basisAmount: "1250000000",
        levels: {
          create: [
            {
              levelNo: 1,
              positionId: positionIds[0]!,
              positionNameSnapshot: "EM",
            },
          ],
        },
      },
      select: { id: true },
    });

    await callRoute(updateTierRoute, {
      cookie: cookieAdmin,
      method: "PATCH",
      params: { id: tierId },
      body: {
        version: 1,
        name: "Tier untuk snapshot",
        forAfce: true,
        forArSupplement: true,
        minAmount: "1000000000",
        maxAmount: "1300000000",
        positionIds: [positionIds[2]],
      },
    });

    const snapshot = await prisma.approvalLevelSnapshot.findMany({
      where: { afceAttemptId: attempt.id },
      select: { levelNo: true, positionId: true, positionNameSnapshot: true },
    });
    expect(snapshot).toEqual([
      {
        levelNo: 1,
        positionId: positionIds[0],
        positionNameSnapshot: "EM",
      },
    ]);
  });

  it("AC-06 tier yang belum ada dijawab 404", async () => {
    const response = await callRoute(updateTierRoute, {
      cookie: cookieAdmin,
      method: "PATCH",
      params: { id: "tier-tidak-ada" },
      body: {
        version: 1,
        name: "Tidak ada",
        forAfce: true,
        forArSupplement: true,
        minAmount: "0",
        maxAmount: "1000",
        positionIds: [positionIds[0]],
      },
    });
    expect(response.status).toBe(404);
  });

  it("AC-18 nominal tanpa tier aktif ditolak dengan pesan yang menyebut nominal", async () => {
    const list = await readJson<{ data: TierData[] }>(
      await callRoute(listTiersRoute, { cookie: cookieAdmin }),
    );
    for (const tier of list.data.filter((row) => row.isActive)) {
      const response = await callRoute(updateTierRoute, {
        cookie: cookieAdmin,
        method: "PATCH",
        params: { id: tier.id },
        body: {
          version: tier.version,
          name: tier.name,
          forAfce: true,
          forArSupplement: true,
          minAmount: tierBawah.id === tier.id ? "0" : "500000000",
          maxAmount: tierBawah.id === tier.id ? "500000000" : "1000000000",
          positionIds: [positionIds[0]],
          isActive: false,
        },
      });
      expect(response.status).toBe(200);
    }

    const response = await callRoute(matchRoute, {
      cookie: cookieSpecialist,
      path: "/api/approval-tiers/match?doc=AFCE&amount=125000000",
    });
    expect(response.status).toBe(409);
    const body = await readJson<Envelope>(response);
    expect(body.error?.code).toBe("PRECONDITION_FAILED");
    expect(body.error?.message).toContain("125000000.00");
  });
});
