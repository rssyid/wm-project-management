import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/infra/auth";
import { prisma } from "@/infra/db";
import type { ProjectStatus } from "@/shared/project-status";

import { callRoute, readJson } from "./helpers/call-route";
import { createProject, createUser, ensureSeed } from "./helpers/factory";

import { POST as decisionRoute } from "@/app/api/approval-levels/[levelId]/decision/route";
import { PUT as boqRoute } from "@/app/api/afce-attempts/[id]/boq/route";
import { POST as createAttemptRoute } from "@/app/api/projects/[id]/afce-attempts/route";
import { POST as submitRoute } from "@/app/api/afce-attempts/[id]/submit/route";
import { GET as budgetRoute } from "@/app/api/projects/[id]/budget/route";

type Envelope = { data?: unknown; error?: { code: string; message: string } };

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

describe("keputusan approval AFCE", () => {
  let cookie: string;
  let userId: string;
  let positionIds: string[];

  beforeAll(async () => {
    await ensureSeed();
    const specialist = await createUser({ role: "WM_HO_SPECIALIST" });
    cookie = await signIn(specialist.email, specialist.password);
    userId = specialist.id;
    positionIds = (
      await prisma.approvalPosition.findMany({
        orderBy: { rank: "asc" },
        take: 2,
        select: { id: true },
      })
    ).map((position) => position.id);

    await prisma.approvalMatrixTier.create({
      data: {
        name: "Tier keputusan",
        forAfce: true,
        forArSupplement: true,
        minAmount: "0",
        levels: {
          create: [
            { levelNo: 1, positionId: positionIds[0]! },
            { levelNo: 2, positionId: positionIds[1]! },
          ],
        },
      },
    });
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

  /** Kembalikan attempt DIAJUKAN beserta level-levelnya. */
  async function submittedAttempt(amount = "450000000.00") {
    const projectId = await projectAt("RAB_READY");
    const created = await callRoute(createAttemptRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: {},
    });
    const attempt = (await readJson<Envelope>(created)).data as { id: string };
    await callRoute(boqRoute, {
      cookie,
      method: "PUT",
      params: { id: attempt.id },
      body: { version: 1, items: [{ activityName: "Galian", amount }] },
    });
    const submit = await callRoute(submitRoute, {
      cookie,
      method: "POST",
      params: { id: attempt.id },
      body: {
        version: 2,
        submittedDate: "2026-10-07",
        approvalEmailDate: "2026-10-06",
      },
    });
    if (submit.status !== 200) {
      throw new Error(
        `Pengajuan gagal: ${JSON.stringify(await readJson(submit))}`,
      );
    }
    const levels = await prisma.approvalLevelSnapshot.findMany({
      where: { afceAttemptId: attempt.id },
      orderBy: { levelNo: "asc" },
      select: { id: true, levelNo: true },
    });
    return { projectId, attemptId: attempt.id, levels };
  }

  async function decide(levelId: string, body: Record<string, unknown>) {
    const response = await callRoute(decisionRoute, {
      cookie,
      method: "POST",
      params: { levelId },
      body,
    });
    return { response, json: await readJson<Envelope>(response) };
  }

  it("AC-21 level kedua tidak boleh diputuskan sebelum level pertama", async () => {
    const { levels } = await submittedAttempt();
    const second = levels[1]!;

    const { response, json } = await decide(second.id, {
      result: "APPROVED",
      approverName: "Bapak RH",
      decisionDate: "2026-10-12",
    });
    expect(response.status).toBe(409);
    expect(json.error?.code).toBe("PRECONDITION_FAILED");
    expect(json.error?.message).toContain("belum diputuskan");
  });

  it("AC-21 tanggal keputusan tidak boleh lebih awal dari tanggal email", async () => {
    const { levels } = await submittedAttempt();
    const first = levels[0]!;

    const { response, json } = await decide(first.id, {
      result: "APPROVED",
      approverName: "Bapak EM",
      decisionDate: "2026-10-05",
    });
    expect(response.status).toBe(400);
    expect(json.error?.message).toContain("2026-10-06");
  });

  it("AC-21 level yang sudah punya keputusan tidak bisa diisi lagi", async () => {
    const { levels } = await submittedAttempt();
    const first = levels[0]!;

    const firstDecision = await decide(first.id, {
      result: "APPROVED",
      approverName: "Bapak EM",
      decisionDate: "2026-10-09",
    });
    expect(firstDecision.response.status).toBe(200);

    const secondDecision = await decide(first.id, {
      result: "DITOLAK",
      approverName: "Bapak EM",
      decisionDate: "2026-10-10",
    });
    expect(secondDecision.response.status).toBe(409);
    expect(secondDecision.json.error?.code).toBe("ACTIVE_CONFLICT");
  });

  it("AC-23 penolakan membuat dokumen Ditolak dan proyek kembali RAB siap", async () => {
    const { projectId, levels } = await submittedAttempt();
    const first = levels[0]!;

    const { response, json } = await decide(first.id, {
      result: "DITOLAK",
      approverName: "Bapak EM",
      decisionDate: "2026-10-10",
      notes: "RAB perlu revisi",
    });
    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      result: "DITOLAK",
      projectStatus: "RAB_READY",
    });

    const attempt = await prisma.afceAttempt.findUniqueOrThrow({
      where: {
        id: (
          await prisma.afceAttempt.findFirstOrThrow({
            where: { projectId },
            orderBy: { attemptNo: "desc" },
            select: { id: true },
          })
        ).id,
      },
      select: { status: true },
    });
    expect(attempt.status).toBe("DITOLAK");
  });

  it("AC-23 attempt baru menyalin BOQ attempt yang ditolak", async () => {
    const { projectId, levels } = await submittedAttempt("320000000.00");
    const first = levels[0]!;
    await decide(first.id, {
      result: "DITOLAK",
      approverName: "Bapak EM",
      decisionDate: "2026-10-10",
    });

    const rejected = await prisma.afceAttempt.findFirstOrThrow({
      where: { projectId, status: "DITOLAK" },
      select: { id: true, attemptNo: true },
    });
    const created = await callRoute(createAttemptRoute, {
      cookie,
      method: "POST",
      params: { id: projectId },
      body: { copyFromAttemptId: rejected.id },
    });
    expect(created.status).toBe(200);

    const next = await prisma.afceAttempt.findFirstOrThrow({
      where: { projectId, attemptNo: rejected.attemptNo + 1 },
      select: { basisAmount: true, boqItems: { select: { amount: true } } },
    });
    expect(next.basisAmount.toFixed(2)).toBe("320000000.00");
    expect(next.boqItems).toHaveLength(1);

    const old = await prisma.afceAttempt.findUniqueOrThrow({
      where: { id: rejected.id },
      select: { status: true, basisAmount: true },
    });
    expect(old.status).toBe("DITOLAK");
    expect(old.basisAmount.toFixed(2)).toBe("320000000.00");
  });

  it("AC-24 level terakhir disetujui memberi status disetujui dan anggaran INITIAL", async () => {
    const { projectId, levels } = await submittedAttempt("450000000.00");

    await decide(levels[0]!.id, {
      result: "APPROVED",
      approverName: "Bapak EM",
      decisionDate: "2026-10-09",
    });
    const final = await decide(levels[1]!.id, {
      result: "APPROVED",
      approverName: "Bapak GEM",
      decisionDate: "2026-10-12",
    });
    expect(final.response.status).toBe(200);
    expect(final.json.data).toMatchObject({
      projectStatus: "AFCE_AR_APPROVED",
    });

    const budget = await readJson<{
      data: { entries: { type: string; amount: string }[] };
    }>(await callRoute(budgetRoute, { cookie, params: { id: projectId } }));
    expect(budget.data.entries).toHaveLength(1);
    expect(budget.data.entries[0]).toMatchObject({
      type: "INITIAL",
      amount: "450000000.00",
    });

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { plannedBudget: true },
    });
    expect(project.plannedBudget?.toFixed(2)).toBe("450000000.00");
  });

  it("AC-05 keputusan approval tercatat sebagai AuditLog dan ApprovalRecord", async () => {
    const { projectId, levels } = await submittedAttempt();
    await decide(levels[0]!.id, {
      result: "APPROVED",
      approverName: "Bapak EM",
      decisionDate: "2026-10-09",
    });

    const records = await prisma.approvalRecord.count({
      where: { levelSnapshot: { afceAttempt: { projectId } } },
    });
    expect(records).toBe(1);

    const logs = await prisma.auditLog.findMany({
      where: { projectId, entityType: "ApprovalRecord" },
    });
    expect(logs).toHaveLength(1);
  });

  it("AC-02 viewer tidak boleh mencatat keputusan", async () => {
    const viewer = await createUser({ role: "MANAGEMENT_VIEWER" });
    const viewerCookie = await signIn(viewer.email, viewer.password);
    const { levels } = await submittedAttempt();

    const response = await callRoute(decisionRoute, {
      cookie: viewerCookie,
      method: "POST",
      params: { levelId: levels[0]!.id },
      body: {
        result: "APPROVED",
        approverName: "Bapak EM",
        decisionDate: "2026-10-09",
      },
    });
    expect(response.status).toBe(403);
  });
});
