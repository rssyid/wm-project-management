import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import {
  POST as createProgressLogRoute,
} from "@/app/api/work-items/[id]/progress-logs/route";
import {
  POST as supersedeProgressLogRoute,
} from "@/app/api/progress-logs/[id]/supersede/route";

type Envelope = {
  data?: unknown;
  error?: { code: string; message: string };
  fields?: Record<string, string>;
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

describe("AC-47, AC-48 log progres mingguan dan alat berat", () => {
  let cookie: string;
  let userId: string;
  let equipmentTypeId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
    userId = specialist.id;
    equipmentTypeId = (
      await prisma.heavyEquipmentType.create({
        data: { name: "Excavator", isActive: true },
        select: { id: true },
      })
    ).id;
  });

  async function processBerjalan() {
    const { project } = await createProject({
      createdById: userId,
      picUserId: userId,
      targetStartDate: new Date(Date.UTC(2026, 9, 1)),
      targetEndDate: new Date(Date.UTC(2026, 10, 30)),
      plannedBudget: "450000000.00",
      status: "EXECUTION",
    });
    const wi = await prisma.workItem.create({
      data: {
        projectId: project.id,
        name: "Pekerjaan Uji",
        type: "TENDER_CONTRACT",
        projectWeightPct: new Prisma.Decimal("100.00"),
        physicalWeightPct: new Prisma.Decimal("100.00"),
        materialWeightPct: new Prisma.Decimal("0.00"),
      },
    });
    const process = await prisma.physicalProcess.create({
      data: { workItemId: wi.id, status: "BERJALAN" },
    });
    return { projectId: project.id, workItemId: wi.id, processId: process.id };
  }

  it("AC-47 log minggu pertama, satu aktif per minggu, log kedua digantikan", async () => {
    const { workItemId, processId } = await processBerjalan();

    const logResponse = await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "20.00",
        notes: "Minggu pertama",
      },
    });
    expect(logResponse.status).toBe(200);

    // Satu log aktif per minggu: log kedua minggu yang sama digantikan
    const log2Response = await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "30.00",
        notes: "Minggu pertama revisi",
      },
    });
    const log2Body = await log2Response.text();
    if (log2Response.status !== 200) {
      throw new Error(`Log kedua gagal: ${log2Response.status} ${log2Body}`);
    }
    const logs = await prisma.progressLog.findMany({
      where: { physicalProcessId: processId },
      orderBy: { recordedAt: "asc" },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]!.supersededById).toBe(logs[1]!.id);
    expect(logs[1]!.supersededById).toBeNull();
  });

  it("AC-47 persen turun tanpa alasan ditolak (409 PRECONDITION_FAILED)", async () => {
    const { workItemId } = await processBerjalan();
    await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "50.00",
      },
    });

    const response = await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-12",
        cumulativePct: "40.00",
      },
    });
    expect(response.status).toBe(409);
    const json = await readJson<Envelope>(response);
    expect(json.error?.code).toBe("PRECONDITION_FAILED");
  });

  it("AC-47 persen turun dengan alasan diterima", async () => {
    const { workItemId } = await processBerjalan();
    await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "50.00",
      },
    });

    const response = await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-12",
        cumulativePct: "40.00",
        decreaseReason: "Curah hujan tinggi",
      },
    });
    expect(response.status).toBe(200);
  });

  it("AC-47 log 100% → proses fisik SELESAI", async () => {
    const { workItemId, processId } = await processBerjalan();
    await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "100.00",
      },
    });
    const process = await prisma.physicalProcess.findUnique({
      where: { id: processId },
    });
    expect(process?.status).toBe("SELESAI");
  });

  it("AC-48 alat berat tersimpan per log dan tidak memengaruhi progres", async () => {
    const { workItemId, processId } = await processBerjalan();
    const response = await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "20.00",
        equipment: [
          {
            heavyEquipmentTypeId: equipmentTypeId,
            unitCount: "2",
            workingHours: "8.0",
            vendorId: null,
            notes: "Gali saluran",
          },
        ],
      },
    });
    expect(response.status).toBe(200);
    const json = await readJson<Envelope>(response);
    const logId = (json.data as { id: string }).id;
    const equipment = await prisma.heavyEquipmentUsage.findMany({
      where: { progressLogId: logId },
    });
    expect(equipment).toHaveLength(1);
    expect(equipment[0]!.unitCount).toBe(2);
    // Progres tetap 20 meski alat berat dipakai
    const log = await prisma.progressLog.findUnique({ where: { id: logId } });
    expect(log?.cumulativePct?.toFixed(2)).toBe("20.00");
    // Alat berat tidak memengaruhi progres (dihitung oleh progress-ews, bukan log itu sendiri)
    const process = await prisma.physicalProcess.findUnique({ where: { id: processId } });
    expect(process?.status).toBe("BERJALAN");
  });

  it("AC-47 log pengganti minggu yang sama; log lama tetap", async () => {
    const { workItemId, processId } = await processBerjalan();
    await callRoute(createProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: workItemId },
      body: {
        weekStart: "2026-10-05",
        cumulativePct: "20.00",
      },
    });
    const log = await prisma.progressLog.findFirst({
      where: { physicalProcessId: processId },
    });

    const response = await callRoute(supersedeProgressLogRoute, {
      cookie,
      method: "POST",
      params: { id: log!.id },
      body: {
        weekStart: "2026-10-05",
        reason: "Input salah minggu lalu",
      },
    });
    const responseBody = await response.text();
    if (response.status !== 200) {
      throw new Error(`Supersede gagal: ${response.status} ${responseBody}`);
    }
    const original = await prisma.progressLog.findUnique({ where: { id: log!.id } });
    expect(original!.supersededById).not.toBeNull();
    const replacement = await prisma.progressLog.findUnique({
      where: { id: original!.supersededById! },
    });
    expect(replacement!.supersededById).toBeNull();
    expect(replacement!.cumulativePct.toFixed(2)).toBe("20.00");
  });
});
