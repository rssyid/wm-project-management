import { describe, expect, it } from "vitest";

import {
  hasEdge,
  HOLDABLE_STATUSES,
  isCancellable,
  isHoldable,
  isTerminal,
  TRANSITION_EDGES,
} from "@/domain/project-transition/gates";
import { PROJECT_STATUSES, type ProjectStatus } from "@/shared/project-status";

describe("tabel transisi proyek", () => {
  it("hanya memuat status yang dikenal Prisma dan tidak ganda", () => {
    const known = new Set<string>(PROJECT_STATUSES);
    const seen = new Set<string>();
    for (const [from, to] of TRANSITION_EDGES) {
      expect(known.has(from), `${from} dikenal`).toBe(true);
      expect(known.has(to), `${to} dikenal`).toBe(true);
      const key = `${from}>${to}`;
      expect(seen.has(key), `${key} tidak ganda`).toBe(false);
      seen.add(key);
    }
  });

  it("AC-15 status tidak pernah mundur otomatis", () => {
    const order: ProjectStatus[] = [
      "DRAFT",
      "SURVEY",
      "RAB_READY",
      "WAITING_AFCE_AR",
      "AFCE_AR_APPROVED",
      "PROCUREMENT",
      "EXECUTION",
      "WAITING_BAST",
      "COMPLETED",
      "CANCELLED",
      "ON_HOLD",
    ];
    for (const [from, to] of TRANSITION_EDGES) {
      if (from === "ON_HOLD" || to === "ON_HOLD") continue;
      if (from === "WAITING_AFCE_AR" && to === "RAB_READY") continue;
      if (from === "WAITING_BAST" && to === "EXECUTION") continue;
      expect(order.indexOf(to), `${from} → ${to} tidak mundur`).toBeGreaterThan(
        order.indexOf(from),
      );
    }
  });

  it("AC-16SURVEY → RAB_READY ada sebagai edge otomatis", () => {
    expect(hasEdge("SURVEY", "RAB_READY")).toBe(true);
  });

  it("menolak edge yang tidak ada di dokumen domain", () => {
    expect(hasEdge("DRAFT", "PROCUREMENT")).toBe(false);
    expect(hasEdge("COMPLETED", "EXECUTION")).toBe(false);
    expect(hasEdge("CANCELLED", "ON_HOLD")).toBe(false);
  });

  it("AC-67 ON_HOLD hanya dari dan ke status yang boleh ditahan", () => {
    expect(hasEdge("DRAFT", "ON_HOLD")).toBe(false);
    for (const status of HOLDABLE_STATUSES) {
      expect(hasEdge(status, "ON_HOLD")).toBe(true);
      expect(hasEdge("ON_HOLD", status)).toBe(true);
    }
  });
});

describe("klasifikasi status", () => {
  it("menandai hanya COMPLETED dan CANCELLED sebagai terminal", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("EXECUTION")).toBe(false);
  });

  it("AC-68 batal proyek boleh dari status non-terminal termasuk DRAFT dan ON_HOLD", () => {
    expect(isCancellable("DRAFT")).toBe(true);
    expect(isCancellable("ON_HOLD")).toBe(true);
    expect(isCancellable("COMPLETED")).toBe(false);
  });

  it("AC-67 DRAFT tidak boleh ditahan", () => {
    expect(isHoldable("DRAFT")).toBe(false);
    expect(isHoldable("SURVEY")).toBe(true);
  });
});
