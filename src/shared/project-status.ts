// Mirrors the Prisma `ProjectStatus` enum. Labels: D-22 (13 Okt 2026), docs/05 §9.
export const PROJECT_STATUSES = [
  "DRAFT",
  "SURVEY",
  "RAB_READY",
  "WAITING_AFCE_AR",
  "AFCE_AR_APPROVED",
  "PROCUREMENT",
  "EXECUTION",
  "WAITING_BAST",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Draf",
  SURVEY: "Survei",
  RAB_READY: "RAB siap",
  WAITING_AFCE_AR: "Menunggu AFCE/AR",
  AFCE_AR_APPROVED: "AFCE/AR disetujui",
  PROCUREMENT: "Pengadaan",
  EXECUTION: "Pelaksanaan",
  WAITING_BAST: "Menunggu BAST",
  COMPLETED: "Selesai",
  ON_HOLD: "Ditahan",
  CANCELLED: "Dibatalkan",
};

export type EwsLevel = "GREEN" | "YELLOW" | "RED";

export const EWS_LEVEL_LABEL: Record<EwsLevel, string> = {
  GREEN: "Hijau",
  YELLOW: "Kuning",
  RED: "Merah",
};
