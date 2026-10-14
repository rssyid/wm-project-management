import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/infra/db";
import { withTransaction } from "@/infra/tx";
import { writeAudit } from "@/domain/audit/service";
import { DomainError } from "@/shared/errors";

import { createUser, ensureSeed } from "./helpers/factory";

describe("audit dalam transaksi", () => {
  let userId: string;

  beforeAll(async () => {
    await ensureSeed();
    const user = await createUser({ role: "WM_HO_SPECIALIST" });
    userId = user.id;
  });

  it("AC-05 mutasi menulis satu AuditLog dengan before dan after", async () => {
    const vendorId = await withTransaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: { name: "CV Sumber Uji", type: "EKSTERNAL" },
      });
      await writeAudit(tx, {
        actorId: userId,
        entityType: "Vendor",
        entityId: vendor.id,
        action: "CREATE",
        after: { name: vendor.name, type: vendor.type },
      });
      return vendor.id;
    });

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Vendor", entityId: vendorId },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorId).toBe(userId);
    expect(logs[0]?.before).toBeNull();
    expect(logs[0]?.after).toEqual({
      name: "CV Sumber Uji",
      type: "EKSTERNAL",
    });
  });

  it("AC-05 perubahan menulis before dan after", async () => {
    const { vendorId } = await withTransaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: { name: "CV Sebelum", type: "EKSTERNAL" },
      });
      await writeAudit(tx, {
        actorId: userId,
        entityType: "Vendor",
        entityId: vendor.id,
        action: "UPDATE",
        before: { name: vendor.name },
        after: { name: "CV Sesudah" },
      });
      return { vendorId: vendor.id };
    });

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Vendor", entityId: vendorId },
    });
    expect(logs[0]?.before).toEqual({ name: "CV Sebelum" });
    expect(logs[0]?.after).toEqual({ name: "CV Sesudah" });
  });

  it("AC-05 audit ikut rollback saat mutasi gagal", async () => {
    const vendorId = await withTransaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: { name: "CV Dibatalkan", type: "EKSTERNAL" },
      });
      await writeAudit(tx, {
        actorId: userId,
        entityType: "Vendor",
        entityId: vendor.id,
        action: "UPDATE",
        before: { name: vendor.name },
        after: { name: "Tidak Jadi" },
      });
      return vendor.id;
    });
    expect(vendorId).toBeTruthy();

    await expect(
      withTransaction(async (tx) => {
        await writeAudit(tx, {
          actorId: userId,
          entityType: "Vendor",
          entityId: vendorId,
          action: "UPDATE",
          after: { name: "Gagal" },
        });
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Prasyarat tidak terpenuhi.",
        );
      }),
    ).rejects.toThrow(DomainError);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Vendor", entityId: vendorId },
    });
    expect(logs).toHaveLength(1);
    expect(
      await prisma.vendor.findUnique({ where: { id: vendorId } }),
    ).not.toBeNull();
  });
});
