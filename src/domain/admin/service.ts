import { writeAudit } from "@/domain/audit/service";
import { hashPassword } from "@/infra/password";
import { prisma } from "@/infra/db";
import { withTransaction } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import type {
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
} from "@/shared/schemas/user";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export function listUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

/**
 * docs/02 §7: hanya Super Admin membuat user, tanpa pendaftaran mandiri. Password dikirim
 * Super Admin sebagai password sementara dan wajib diganti pada login pertama.
 */
export async function createUserAccount(
  input: CreateUserInput,
  actorId: string,
) {
  const hashed = await hashPassword(input.temporaryPassword);
  return withTransaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new DomainError(
        "DUPLICATE",
        "Email tersebut sudah dipakai user lain.",
      );
    }
    const userId = crypto.randomUUID();
    const user = await tx.user.create({
      data: {
        id: userId,
        name: input.name,
        email: input.email,
        emailVerified: true,
        role: input.role,
        isActive: true,
        mustChangePassword: true,
      },
      select: USER_SELECT,
    });
    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
      },
    });
    await writeAudit(tx, {
      actorId,
      entityType: "User",
      entityId: userId,
      action: "CREATE",
      after: { name: user.name, email: user.email, role: user.role },
    });
    return user;
  });
}

export async function updateUserAccount(
  id: string,
  input: UpdateUserInput,
  actorId: string,
) {
  return withTransaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!before) throw new DomainError("NOT_FOUND", "User tidak ditemukan.");

    if (input.isActive === false && before.id === actorId) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Tidak bisa menonaktifkan akun Anda sendiri.",
      );
    }

    const user = await tx.user.update({
      where: { id },
      data: input,
      select: USER_SELECT,
    });

    // User nonaktif langsung kehilangan semua session-nya (AC-03).
    if (input.isActive === false) {
      await tx.session.deleteMany({ where: { userId: id } });
    }

    await writeAudit(tx, {
      actorId,
      entityType: "User",
      entityId: id,
      action: input.isActive === false ? "DEACTIVATE" : "UPDATE",
      before,
      after: user,
    });
    return user;
  });
}

/** docs/04 §11: reset password dicatat RESET_PASSWORD dan mencabut semua session. */
export async function resetUserPassword(
  id: string,
  input: ResetPasswordInput,
  actorId: string,
) {
  const hashed = await hashPassword(input.temporaryPassword);
  return withTransaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new DomainError("NOT_FOUND", "User tidak ditemukan.");

    const account = await tx.account.findFirst({
      where: { userId: id, providerId: "credential" },
      select: { id: true },
    });
    if (!account) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "User ini belum memiliki password email.",
      );
    }

    await tx.account.update({
      where: { id: account.id },
      data: { password: hashed },
    });
    await tx.user.update({ where: { id }, data: { mustChangePassword: true } });
    await tx.session.deleteMany({ where: { userId: id } });

    await writeAudit(tx, {
      actorId,
      entityType: "User",
      entityId: id,
      action: "RESET_PASSWORD",
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: true },
      reason: "Password direset Super Admin; seluruh session dicabut.",
    });
    return { id, mustChangePassword: true };
  });
}
