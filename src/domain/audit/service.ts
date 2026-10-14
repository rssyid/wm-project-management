import { DomainError } from "@/shared/errors";
import type { Tx } from "@/infra/tx";
import { Prisma } from "@/generated/prisma/client";

/** Kata kerja aksi; `entityType` selalu nama model. docs/03 §5 memakai IMPORT untuk seed. */
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "DEACTIVATE"
  | "IMPORT"
  | "RESET_PASSWORD"
  | "CHANGE_PASSWORD";

export type AuditEntry = {
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  projectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
};

/**
 * Prisma hanya menerima JSON tanpa Decimal atau Date; serialisasi di sini menjaga agar
 * pemanggil bisa mengirim objek domain apa adanya.
 */
function toJson(value: Record<string, unknown> | null | undefined) {
  if (value === null || value === undefined) return value ?? undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** AC-05: satu AuditLog per mutasi, ditulis dalam transaksi yang sama. */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      projectId: entry.projectId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      before: toJson(entry.before),
      after: toJson(entry.after),
      reason: entry.reason ?? null,
    },
  });
}

/**
 * docs/02 §4: entitas ber-version wajib mengirim version; `updateMany` dengan
 * `{ id, version }` mengembalikan 0 baris bila data sudah diubah orang lain.
 */
export function assertUpdated(count: number): void {
  if (count === 0) throw versionConflict();
}

export function versionConflict(): DomainError {
  return new DomainError(
    "VERSION_CONFLICT",
    "Data sudah diubah orang lain. Muat ulang halaman lalu ulangi.",
  );
}
