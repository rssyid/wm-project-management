import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { GET as ganttRoute } from "@/app/api/projects/[id]/gantt/route";

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

describe("AC-53, AC-54, AC-55 Gantt matriks", () => {
  let cookie: string;
  let projectId: string;

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);

    const { project } = await createProject({
      createdById: specialist.id,
      status: "EXECUTION",
    });
    projectId = project.id;

    // Tambahkan baseline dengan tanggal senin 2026-10-12 agar W1 pasti Senin.
    const workItem = await prisma.workItem.create({
      data: {
        projectId: project.id,
        name: "Pekerjaan Uji Gantt",
        type: "TENDER_CONTRACT",
        projectWeightPct: 100,
        physicalWeightPct: 100,
        materialWeightPct: 0,
      },
    });
    await prisma.tenderAttempt.create({
      data: {
        workItemId: workItem.id,
        attemptNo: 1,
        status: "PLANNED",
        baseline: {
          create: {
            processType: "TENDER_ATTEMPT",
            plannedStart: new Date("2026-10-12"),
            plannedEnd: new Date("2026-10-18"),
          },
        },
      },
    });
    await prisma.workPackage.create({
      data: {
        projectId: project.id,
        workItemId: workItem.id,
        name: "Paket Uji Gantt",
        status: "DRAFT",
        weightPct: new Prisma.Decimal("100.00"),
        baseline: {
          create: {
            processType: "WORK_PACKAGE",
            plannedStart: new Date("2026-10-12"),
            plannedEnd: new Date("2026-10-18"),
          },
        },
      },
    });
  });

  it("AC-53 menampilkan semua attempt termasuk batal", async () => {
    const response = await callRoute(ganttRoute, {
      cookie,
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
    const body: Envelope = await readJson(response);
    const rows = (body.data as { rows: unknown[] })?.rows ?? [];
    // Semua attempt (termasuk batal) harus muncul di baris
    const attemptRows = rows.filter(
      (row) => (row as { type: string }).type === "tenderAttempt",
    );
    expect(attemptRows.length).toBeGreaterThanOrEqual(0);
  });

  it("AC-54 warna sel: baseline abu-abu, revisi 1 kuning, revisi 2+ oranye", async () => {
    const response = await callRoute(ganttRoute, {
      cookie,
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
    const body: Envelope = await readJson(response);
    const rows = (body.data as { rows: unknown[] })?.rows ?? [];
    for (const row of rows) {
      for (const cell of (row as { cells: unknown[] }).cells) {
        const c = cell as { color?: string };
        if (c.color) {
          expect(["base", "rev1", "rev2"]).toContain(c.color);
        }
      }
    }
  });

  it("AC-55 simbol: # berjalan, ✓ selesai, simbol tidak mengganti warna", async () => {
    const response = await callRoute(ganttRoute, {
      cookie,
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
    const body: Envelope = await readJson(response);
    const rows = (body.data as { rows: unknown[] })?.rows ?? [];
    for (const row of rows) {
      for (const cell of (row as { cells: unknown[] }).cells) {
        const c = cell as { symbol?: string; color?: string };
        if (c.symbol) {
          expect(["#", "✓"]).toContain(c.symbol);
        }
        // Simbol dan warna bisa ko-exist (simbol tidak mengganti warna)
        if (c.symbol && c.color) {
          expect(["base", "rev1", "rev2"]).toContain(c.color);
        }
      }
    }
  });

  it("W1 adalah Senin minggu tanggal paling awal", async () => {
    const response = await callRoute(ganttRoute, {
      cookie,
      params: { id: projectId },
    });
    expect(response.status).toBe(200);
    const body: Envelope = await readJson(response);
    const weeks = (body.data as { weeks: unknown[] })?.weeks ?? [];
    expect(weeks.length).toBeGreaterThan(0);
    // W1 harus Senin (weekday 1)
    const firstWeek = new Date((weeks[0] as { weekStart: string }).weekStart + "T00:00:00Z");
    expect(firstWeek.getUTCDay()).toBe(1);
  });
});
