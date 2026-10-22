import { prisma } from "@/infra/db";
import { Prisma } from "@/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

/**
 * docs/02 §4: setiap mutasi membungkus perubahan data dan AuditLog dalam satu transaksi,
 * supaya audit tidak pernah terpisah dari perubahannya.
 */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: 15_000,
  });
}
