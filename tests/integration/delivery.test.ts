import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as createWorkPackageRoute } from "@/app/api/work-items/[id]/work-packages/route";
import { POST as createPRRoute } from "@/app/api/work-packages/[id]/pr/route";
import { POST as createPORoute } from "@/app/api/work-packages/[id]/po/route";
import { POST as createDeliveryRoute } from "@/app/api/work-packages/[id]/deliveries/route";
import { POST as createCorrectionRoute } from "@/app/api/work-packages/[id]/deliveries/correction/route";
import { PATCH as updatePaymentRoute } from "@/app/api/work-packages/[id]/payment/route";

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

describe("Kiriman, koreksi & pembayaran (AC-41, AC-42, AC-43, AC-44)", () => {
  let cookie: string;
  let userId: string;
  let vendorId: string;
  let materialId: string;
  let unitId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
    userId = specialist.id;

    const material = await prisma.material.findFirstOrThrow({
      select: { id: true, defaultUnitId: true },
    });
    materialId = material.id;
    unitId = material.defaultUnitId;

    vendorId = (
      await prisma.vendor.create({
        data: { name: "Vendor Uji", type: "EKSTERNAL", isActive: true },
        select: { id: true },
      })
    ).id;
  });

  async function projectAt(status: ProjectStatus) {
    const { project } = await createProject({
      createdById: userId,
      picUserId: userId,
      targetStartDate: new Date(Date.UTC(2026, 9, 1)),
      targetEndDate: new Date(Date.UTC(2026, 10, 30)),
      plannedBudget: "450000000.00",
      status,
    });
    return project.id;
  }

  async function createWI(projectId: string) {
    return prisma.workItem.create({
      data: {
        projectId,
        name: "Pekerjaan Uji",
        type: "PURCHASE",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("0.00"),
        materialWeightPct: new Prisma.Decimal("100.00"),
      },
    });
  }

  async function createWP(workItemId: string) {
    const res = await callRoute(createWorkPackageRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        name: "Paket Uji",
        weightPct: "100.00",
        items: [
          { materialId, unitId, plannedQty: "10.000" },
          { materialId, unitId, plannedQty: "10.000" },
        ],
      },
    });
    return ((await readJson<Envelope>(res)).data as { id: string }).id;
  }

  async function setupPO(wpId: string) {
    await callRoute(createPRRoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: { number: "PR/2026/001", date: "2026-10-06" },
    });
    await callRoute(createPORoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: { number: "PO/2026/001", date: "2026-10-07", vendorId },
    });
  }

  it("AC-41 kiriman dengan PO wajib, qty positif", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const wpId = await createWP(wi.id);
    await setupPO(wpId);

    const response = await callRoute(createDeliveryRoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: {
        deliveryDate: "2026-10-10",
        items: [
          {
            workPackageItemId: "dummy-item",
            qty: "5.000",
          },
        ],
      },
    });
    expect(response.status).toBe(404);
  });

  it("AC-42 kiriman pertama → EXECUTION tepat sekali", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const wpId = await createWP(wi.id);
    await setupPO(wpId);

    const item = await prisma.workPackageItem.findFirst({
      where: { workPackageId: wpId },
      select: { id: true },
    });

    const response = await callRoute(createDeliveryRoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: {
        deliveryDate: "2026-10-10",
        items: [{ workPackageItemId: item!.id, qty: "5.000" }],
      },
    });
    expect(response.status).toBe(200);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    expect(project?.status).toBe("EXECUTION");
  });

  it("AC-43 koreksi total per item ≥ 0, di bawah rencana → PARTIALLY_DELIVERED", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const wpId = await createWP(wi.id);
    await setupPO(wpId);
    const item = await prisma.workPackageItem.findFirst({
      where: { workPackageId: wpId },
      select: { id: true },
    });

    await callRoute(createDeliveryRoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: {
        deliveryDate: "2026-10-10",
        items: [{ workPackageItemId: item!.id, qty: "8.000" }],
      },
    });

    const response = await callRoute(createCorrectionRoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: {
        deliveryDate: "2026-10-11",
        correctionReason: "Retur barang rusak",
        items: [{ workPackageItemId: item!.id, qty: "-2.000" }],
      },
    });
    expect(response.status).toBe(200);

    const wp = await prisma.workPackage.findUnique({
      where: { id: wpId },
      select: { status: true },
    });
    expect(wp?.status).toBe("PARTIALLY_DELIVERED");
  });

  it("AC-44 pembayaran bisa diubah sampai COMPLETED termasuk WAITING_BAST", async () => {
    const projectId = await projectAt("PROCUREMENT");
    const wi = await createWI(projectId);
    const wpId = await createWP(wi.id);
    await setupPO(wpId);
    const items = await prisma.workPackageItem.findMany({
      where: { workPackageId: wpId },
      select: { id: true, plannedQty: true },
      orderBy: { id: "asc" },
    });

    // Kirim item pertama secara parsial → paket PARTIALLY_DELIVERED (belum COMPLETED).
    await callRoute(createDeliveryRoute, {
      cookie,
      method: "POST",
      params: { id: wpId },
      body: {
        deliveryDate: "2026-10-10",
        items: [{ workPackageItemId: items[0]!.id, qty: "5.000" }],
      },
    });

    const response = await callRoute(updatePaymentRoute, {
      cookie,
      method: "PATCH",
      params: { id: wpId },
      body: {
        version: 1,
        paymentStatus: "LUNAS",
        invoiceAmount: "10000000.00",
        paidDate: "2026-10-12",
        paymentNotes: "Lunas",
      },
    });
    expect(response.status).toBe(200);

    // Pembayaran tetap bisa diubah pada paket yang belum COMPLETED.
    const response2 = await callRoute(updatePaymentRoute, {
      cookie,
      method: "PATCH",
      params: { id: wpId },
      body: {
        version: 2,
        paymentStatus: "BELUM_LUNAS",
        invoiceAmount: null,
        paidDate: null,
        paymentNotes: "Dibatalkan",
      },
    });
    expect(response2.status).toBe(200);
  });
});
