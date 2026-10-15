import { describe, expect, it } from "vitest";

import { assertDecisionAllowed, levelDurations } from "@/domain/afce/duration";
import { DomainError } from "@/shared/errors";

const emailDate = "2026-10-18";

describe("AC-22 durasi level approval", () => {
  it("level 1 dihitung dari tanggal email approval", () => {
    const rows = levelDurations(emailDate, [
      {
        result: "APPROVED",
        decisionDate: "2026-10-21",
        positionNameSnapshot: "EM",
      },
    ]);
    expect(rows[0]).toMatchObject({
      levelNo: 1,
      startDate: "2026-10-18",
      durationDays: 3,
    });
  });

  it("level berikutnya dihitung dari keputusan level sebelumnya", () => {
    const rows = levelDurations(emailDate, [
      {
        result: "APPROVED",
        decisionDate: "2026-10-21",
        positionNameSnapshot: "EM",
      },
      {
        result: "APPROVED",
        decisionDate: "2026-10-28",
        positionNameSnapshot: "GEM",
      },
      {
        result: "APPROVED",
        decisionDate: "2026-11-02",
        positionNameSnapshot: "RH",
      },
    ]);
    expect(rows.map((row) => row.durationDays)).toEqual([3, 7, 5]);
  });

  it("menerima tanggal dari database dalam bentuk Date", () => {
    const rows = levelDurations(emailDate, [
      {
        result: "APPROVED",
        decisionDate: new Date(2026, 9, 19),
        positionNameSnapshot: "EM",
      },
    ]);
    expect(rows[0]?.durationDays).toBe(1);
  });
});

describe("AC-21 urutan dan aturan tanggal keputusan", () => {
  const today = "2026-10-30";

  it("menerima tanggal yang tidak di masa depan", () => {
    expect(() =>
      assertDecisionAllowed({
        decisionDate: "2026-10-30",
        today,
        approvalEmailDate: emailDate,
        previousDecisions: [],
      }),
    ).not.toThrow();
  });

  it("AC-21 menolak tanggal keputusan di masa depan", () => {
    try {
      assertDecisionAllowed({
        decisionDate: "2026-10-31",
        today,
        approvalEmailDate: emailDate,
        previousDecisions: [],
      });
      throw new Error("harusnya menolak tanggal masa depan");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("AC-21 menolak tanggal lebih awal dari tanggal email untuk level 1", () => {
    try {
      assertDecisionAllowed({
        decisionDate: "2026-10-17",
        today,
        approvalEmailDate: emailDate,
        previousDecisions: [],
      });
      throw new Error("harusnya menolak tanggal sebelum email");
    } catch (error) {
      expect((error as DomainError).message).toContain("2026-10-18");
    }
  });

  it("AC-21 menolak tanggal lebih awal dari keputusan level sebelumnya", () => {
    expect(() =>
      assertDecisionAllowed({
        decisionDate: "2026-10-20",
        today,
        approvalEmailDate: emailDate,
        previousDecisions: [{ result: "APPROVED", decisionDate: "2026-10-21" }],
      }),
    ).toThrow(/2026-10-21/);
  });

  it("AC-21 menolak level berikutnya bila level sebelumnya ditolak", () => {
    try {
      assertDecisionAllowed({
        decisionDate: "2026-10-22",
        today,
        approvalEmailDate: emailDate,
        previousDecisions: [{ result: "DITOLAK", decisionDate: "2026-10-21" }],
      });
      throw new Error("harusnya menolak level setelah penolakan");
    } catch (error) {
      expect((error as DomainError).code).toBe("PRECONDITION_FAILED");
    }
  });

  it("menerima tanggal sama dengan keputusan level sebelumnya", () => {
    expect(() =>
      assertDecisionAllowed({
        decisionDate: "2026-10-21",
        today,
        approvalEmailDate: emailDate,
        previousDecisions: [{ result: "APPROVED", decisionDate: "2026-10-21" }],
      }),
    ).not.toThrow();
  });
});
