// Mirrors the Prisma `Role` enum; usable on the client where the generated client is not.
export const ROLES = ["SUPER_ADMIN", "WM_HO_SPECIALIST", "MANAGEMENT_VIEWER"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  WM_HO_SPECIALIST: "WM HO Specialist",
  MANAGEMENT_VIEWER: "Management Viewer",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
