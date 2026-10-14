import type { ReactNode } from "react";

import { getSessionUser } from "@/infra/session";

/**
 * Pengganti simulasi peran prototipe F0: peran sekarang berasal dari session, jadi
 * Management Viewer tidak melihat tombol aksi di server. Dihapus bersama prototipe di F2.
 */
export async function MutationsOnly({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role === "MANAGEMENT_VIEWER") return null;
  return children;
}
