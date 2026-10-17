import { DomainError } from "@/shared/errors";
import type { Role } from "@/shared/role";

/** Aksi yang dipakai fase ini; setiap fase menambah kebutuhannya sendiri. */
export const ACTIONS = [
  "read",
  "master.write",
  "file.write",
  "user.manage",
  "project.write",
  "approval.record",
  "approval.matrix.manage",
  "project.cancel",
  "settings.manage",
] as const;

export type Action = (typeof ACTIONS)[number];

// docs/01 §2: 403 hanya untuk role. Gate dan prasyarat lain memakai 409.
const ROLE_MATRIX: Record<Action, readonly Role[]> = {
  read: ["SUPER_ADMIN", "WM_HO_SPECIALIST", "MANAGEMENT_VIEWER"],
  "master.write": ["SUPER_ADMIN", "WM_HO_SPECIALIST"],
  "file.write": ["SUPER_ADMIN", "WM_HO_SPECIALIST"],
  "user.manage": ["SUPER_ADMIN"],
  "project.write": ["SUPER_ADMIN", "WM_HO_SPECIALIST"],
  "approval.record": ["SUPER_ADMIN", "WM_HO_SPECIALIST"],
  "approval.matrix.manage": ["SUPER_ADMIN"],
  "project.cancel": ["SUPER_ADMIN"],
  "settings.manage": ["SUPER_ADMIN"],
};

export function assertCan(
  user: { role: Role } | null,
  action: Action,
): asserts user is { role: Role } {
  if (!user) {
    throw new DomainError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
  }
  if (!ROLE_MATRIX[action].includes(user.role)) {
    throw new DomainError(
      "FORBIDDEN_ROLE",
      "Peran Anda tidak berhak untuk aksi ini.",
    );
  }
}

export function can(role: Role, action: Action): boolean {
  return ROLE_MATRIX[action].includes(role);
}
