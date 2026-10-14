/** Ops Region; enum Prisma `Ops` dipakai apa adanya. */
export const OPS = ["SUMATERA", "KALBAR", "WILTIM"] as const;

export type Ops = (typeof OPS)[number];

export const OPS_LABEL: Record<Ops, string> = {
  SUMATERA: "Sumatera",
  KALBAR: "Kalbar",
  WILTIM: "Kalimantan Timur",
};

/** docs/04 §2: satu path untuk sebelas master, dipetakan lewat daftar di bawah. */
export const MASTER_TYPES = [
  "regions",
  "wilayah",
  "companies",
  "estates",
  "blocks",
  "vendors",
  "units",
  "project-categories",
  "materials",
  "heavy-equipment-types",
  "approval-positions",
] as const;

export type MasterType = (typeof MASTER_TYPES)[number];

export function isMasterType(value: string): value is MasterType {
  return (MASTER_TYPES as readonly string[]).includes(value);
}
