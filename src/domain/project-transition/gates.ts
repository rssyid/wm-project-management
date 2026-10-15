import type { ProjectStatus } from "@/shared/project-status";

/**
 * Edge transisi dari docs/01-domain.md §5. Satu-satunya tempat yang menyatakan pasangan status
 * mana yang sah; modul lain memanggil `assertAllowedTransition`, bukan menulis status sendiri.
 * Pemicu (manual atau otomatis) ditentukan modul pemanggil, bukan tabel ini.
 */
export const TRANSITION_EDGES: readonly (readonly [
  ProjectStatus,
  ProjectStatus,
])[] = [
  ["DRAFT", "SURVEY"],
  ["SURVEY", "RAB_READY"],
  ["RAB_READY", "WAITING_AFCE_AR"],
  ["WAITING_AFCE_AR", "AFCE_AR_APPROVED"],
  ["WAITING_AFCE_AR", "RAB_READY"],
  ["AFCE_AR_APPROVED", "PROCUREMENT"],
  ["PROCUREMENT", "EXECUTION"],
  ["EXECUTION", "WAITING_BAST"],
  ["WAITING_BAST", "EXECUTION"],
  ["WAITING_BAST", "COMPLETED"],
  ["SURVEY", "ON_HOLD"],
  ["RAB_READY", "ON_HOLD"],
  ["WAITING_AFCE_AR", "ON_HOLD"],
  ["AFCE_AR_APPROVED", "ON_HOLD"],
  ["PROCUREMENT", "ON_HOLD"],
  ["EXECUTION", "ON_HOLD"],
  ["WAITING_BAST", "ON_HOLD"],
  ["ON_HOLD", "SURVEY"],
  ["ON_HOLD", "RAB_READY"],
  ["ON_HOLD", "WAITING_AFCE_AR"],
  ["ON_HOLD", "AFCE_AR_APPROVED"],
  ["ON_HOLD", "PROCUREMENT"],
  ["ON_HOLD", "EXECUTION"],
  ["ON_HOLD", "WAITING_BAST"],
];

const EDGES = new Set(TRANSITION_EDGES.map(([from, to]) => `${from}>${to}`));

/** Status yang boleh ditahan; DRAFT tidak termasuk (docs/01 §5). */
export const HOLDABLE_STATUSES: readonly ProjectStatus[] = [
  "SURVEY",
  "RAB_READY",
  "WAITING_AFCE_AR",
  "AFCE_AR_APPROVED",
  "PROCUREMENT",
  "EXECUTION",
  "WAITING_BAST",
];

export const TERMINAL_STATUSES: readonly ProjectStatus[] = [
  "COMPLETED",
  "CANCELLED",
];

export function isHoldable(status: ProjectStatus): boolean {
  return HOLDABLE_STATUSES.includes(status);
}

export function isTerminal(status: ProjectStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function hasEdge(from: ProjectStatus, to: ProjectStatus): boolean {
  return EDGES.has(`${from}>${to}`);
}

/** Batal proyek boleh dari status non-terminal apa pun, termasuk DRAFT dan ON_HOLD. */
export function isCancellable(status: ProjectStatus): boolean {
  return !isTerminal(status);
}
