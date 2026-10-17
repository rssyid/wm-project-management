// docs/04 §11: pengaturan sistem (hari kerja dan ambang EWS) serta libur.
// Hanya Super Admin yang boleh mengubah; pembaca semua role.
import { writeAudit } from "@/domain/audit/service";
import { withTransaction } from "@/infra/tx";
import { decimal } from "@/infra/decimal";
import { prisma } from "@/infra/db";
import { DomainError } from "@/shared/errors";

export type SettingsInput = {
  workingWeekdays?: number[];
  ewsYellowFrom?: string;
  ewsRedAbove?: string;
};

export type HolidayInput = {
  date: string;
  name: string;
};

/** Baca pengaturan sistem (selalu satu baris id = 1). */
export async function getSettings() {
  return prisma.systemSetting.findUniqueOrThrow({ where: { id: 1 } });
}

/** Ubah pengaturan sistem. Hanya SA. */
export async function updateSettings(input: SettingsInput, actorId: string) {
  return withTransaction(async (tx) => {
    const setting = await tx.systemSetting.findUnique({ where: { id: 1 } });
    if (!setting) {
      throw new DomainError("NOT_FOUND", "Pengaturan sistem tidak ditemukan.");
    }

    const data: Record<string, unknown> = {};
    if (input.workingWeekdays !== undefined) {
      data.workingWeekdays = input.workingWeekdays;
    }
    if (input.ewsYellowFrom !== undefined) {
      data.ewsYellowFrom = decimal(input.ewsYellowFrom);
    }
    if (input.ewsRedAbove !== undefined) {
      data.ewsRedAbove = decimal(input.ewsRedAbove);
    }

    const updated = await tx.systemSetting.update({
      where: { id: 1 },
      data,
    });

    await writeAudit(tx, {
      actorId,
      entityType: "SystemSetting",
      entityId: "1",
      action: "UPDATE",
      before: {
        workingWeekdays: setting.workingWeekdays,
        ewsYellowFrom: setting.ewsYellowFrom.toString(),
        ewsRedAbove: setting.ewsRedAbove.toString(),
      },
      after: {
        workingWeekdays: updated.workingWeekdays,
        ewsYellowFrom: updated.ewsYellowFrom.toString(),
        ewsRedAbove: updated.ewsRedAbove.toString(),
      },
      reason: "Ubah pengaturan sistem",
    });

    return updated;
  });
}

/** Daftar libur. */
export async function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: "asc" } });
}

/** Tambah libur. Hanya SA. */
export async function createHoliday(input: HolidayInput, actorId: string) {
  return withTransaction(async (tx) => {
    const created = await tx.holiday.create({
      data: { date: new Date(input.date), name: input.name },
    });
    await writeAudit(tx, {
      actorId,
      entityType: "Holiday",
      entityId: created.id,
      action: "CREATE",
      after: { date: input.date, name: input.name },
      reason: "Tambah libur",
    });
    return created;
  });
}

/** Hapus libur. Hanya SA. */
export async function deleteHoliday(id: string, actorId: string) {
  return withTransaction(async (tx) => {
    const holiday = await tx.holiday.findUnique({ where: { id } });
    if (!holiday) {
      throw new DomainError("NOT_FOUND", "Libur tidak ditemukan.");
    }
    await tx.holiday.delete({ where: { id } });
    await writeAudit(tx, {
      actorId,
      entityType: "Holiday",
      entityId: id,
      action: "DELETE",
      before: { date: holiday.date, name: holiday.name },
      reason: "Hapus libur",
    });
    return { id };
  });
}
