import type { E2eRole } from "../accounts";

/** Lokasi file storageState yang ditulis tests/e2e/auth.setup.ts. */
export function storageStatePath(role: E2eRole): string {
  return `test-results/auth/${role}.json`;
}
