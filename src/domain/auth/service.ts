import { withTransaction } from "@/infra/tx";
import { hashPassword } from "@/infra/password";
import { writeAudit } from "@/domain/audit/service";
import { DomainError } from "@/shared/errors";

/**
 * docs/02 §7 dan AC-04: user baru atau yang di-reset wajib mengganti password lebih dulu.
 * Password tidak pernah ikut disimpan di AuditLog.
 */
export async function changeOwnPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const hashed = await hashPassword(newPassword);
  await withTransaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    });
    if (!account) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Akun ini belum memiliki password email. Hubungi Super Admin.",
      );
    }
    await tx.account.update({
      where: { id: account.id },
      data: { password: hashed },
    });
    await tx.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    });
    await writeAudit(tx, {
      actorId: userId,
      entityType: "User",
      entityId: userId,
      action: "CHANGE_PASSWORD",
      before: { mustChangePassword: true },
      after: { mustChangePassword: false },
    });
  });
}
