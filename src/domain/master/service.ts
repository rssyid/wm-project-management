import { versionConflict, writeAudit } from "@/domain/audit/service";
import { withTransaction } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import type { MasterType } from "@/shared/location";
import {
  quickMaterialSchema,
  quickVendorSchema,
  type QuickMaterialInput,
  type QuickVendorInput,
} from "@/shared/schemas/master";

import {
  masterDefinition,
  type MasterFilters,
  type MasterDefinition,
} from "./registry";

function definitionFor(type: MasterType): MasterDefinition {
  return masterDefinition(type);
}

function rowId(row: unknown): string {
  const id = (row as { id?: unknown } | null)?.id;
  if (typeof id !== "string") {
    throw new DomainError("INTERNAL_ERROR", "Baris tersimpan tanpa id.");
  }
  return id;
}

function asAudit(row: unknown): Record<string, unknown> | null {
  if (row === null || row === undefined) return null;
  return row as Record<string, unknown>;
}

export async function listMaster(type: MasterType, filters: MasterFilters) {
  const definition = definitionFor(type);
  return withTransaction((tx) => definition.list(tx, filters));
}

export async function createMaster(
  type: MasterType,
  input: unknown,
  actorId: string,
) {
  const definition = definitionFor(type);
  const values = definition.createSchema.parse(input) as Record<
    string,
    unknown
  >;

  return withTransaction(async (tx) => {
    const created = await definition.create(tx, values);
    await writeAudit(tx, {
      actorId,
      entityType: definition.entityType,
      entityId: rowId(created),
      action: "CREATE",
      after: asAudit(created),
    });
    return created;
  });
}

export async function updateMaster(
  type: MasterType,
  id: string,
  input: unknown,
  version: number | undefined,
  actorId: string,
) {
  const definition = definitionFor(type);
  const values = definition.updateSchema.parse(input) as Record<
    string,
    unknown
  >;
  if (Object.keys(values).length === 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Tidak ada perubahan yang dikirim.",
    );
  }

  return withTransaction(async (tx) => {
    const result = await definition.update(tx, id, values, version);
    if (!result) {
      // Tanpa version, 0 baris berarti data sudah tidak ada; dengan version berarti
      // orang lain mengubahnya lebih dulu (docs/02 §4).
      throw definition.hasVersion && version !== undefined
        ? versionConflict()
        : new DomainError("NOT_FOUND", "Data tidak ditemukan.");
    }
    await writeAudit(tx, {
      actorId,
      entityType: definition.entityType,
      entityId: id,
      action: "UPDATE",
      before: asAudit(result.before),
      after: asAudit(result.after),
    });
    return result.after;
  });
}

/** docs/04 §2: menonaktifkan tanpa menghapus; dipakai juga untuk "Aktif" kembali. */
export async function setMasterActive(
  type: MasterType,
  id: string,
  isActive: boolean,
  actorId: string,
) {
  const definition = definitionFor(type);
  // Skema update menyalin field; kalau isActive tidak lolos skema, perubahan akan diam-diam
  // tidak terjadi. Validasi di sini supaya kesalahan konfigurasi langsung terlihat.
  const values = definition.updateSchema.parse({ isActive });
  if (values.isActive === undefined) {
    throw new DomainError("VALIDATION_ERROR", "Status aktif tidak dikenali.");
  }

  return withTransaction(async (tx) => {
    const result = await definition.update(
      tx,
      id,
      values as Record<string, unknown>,
    );
    if (!result) throw new DomainError("NOT_FOUND", "Data tidak ditemukan.");
    await writeAudit(tx, {
      actorId,
      entityType: definition.entityType,
      entityId: id,
      action: isActive ? "UPDATE" : "DEACTIVATE",
      before: asAudit(result.before),
      after: asAudit(result.after),
    });
    return result.after;
  });
}

/** AC-60: data terpakai hanya dinonaktifkan, jadi DELETE menjawab 409 IN_USE. */
export async function deleteMaster(
  type: MasterType,
  id: string,
  actorId: string,
) {
  const definition = definitionFor(type);

  await withTransaction(async (tx) => {
    if (await definition.isUsed(tx, id)) {
      throw new DomainError(
        "IN_USE",
        `${definition.label} sudah dipakai dan tidak bisa dihapus. Nonaktifkan saja.`,
      );
    }
    const before = await definition.list(tx, {});
    const row = (before as { id: string }[]).find((item) => item.id === id);
    if (!row) throw new DomainError("NOT_FOUND", "Data tidak ditemukan.");
    await definition.remove(tx, id);
    await writeAudit(tx, {
      actorId,
      entityType: definition.entityType,
      entityId: id,
      action: "DELETE",
      before: asAudit(row),
    });
  });
}

/** docs/04 §2: vendor cepat dari nama saja, isComplete=false sampai dilengkapi. */
export async function createQuickVendor(
  input: QuickVendorInput,
  actorId: string,
) {
  const values = quickVendorSchema.parse(input);
  return withTransaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: { name: values.name, type: values.type, isComplete: false },
    });
    await writeAudit(tx, {
      actorId,
      entityType: "Vendor",
      entityId: vendor.id,
      action: "CREATE",
      after: { name: vendor.name, type: vendor.type, isComplete: false },
    });
    return vendor;
  });
}

export async function createQuickMaterial(
  input: QuickMaterialInput,
  actorId: string,
) {
  const values = quickMaterialSchema.parse(input);
  return withTransaction(async (tx) => {
    const material = await tx.material.create({
      data: {
        name: values.name,
        defaultUnitId: values.defaultUnitId,
        isComplete: false,
      },
      include: { defaultUnit: { select: { code: true, name: true } } },
    });
    await writeAudit(tx, {
      actorId,
      entityType: "Material",
      entityId: material.id,
      action: "CREATE",
      after: { name: material.name, isComplete: false },
    });
    return material;
  });
}
