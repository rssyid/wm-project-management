import { writeAudit } from "@/domain/audit/service";
import { prisma } from "@/infra/db";
import {
  downloadUrlTtlSeconds,
  presignDownload,
  presignUpload,
  removeObject,
  statObject,
  uploadUrlTtlSeconds,
} from "@/infra/r2";
import { withTransaction } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import { assertAccepted, extensionOf, maxBytesFor } from "@/shared/file";
import type { UploadUrlInput } from "@/shared/schemas/file";

const PENDING_MAX_AGE_HOURS = 24;

/** docs/04 §9: server membuat kunci dan URL unggah; browser mengunggah langsung ke R2. */
export async function createUploadUrl(input: UploadUrlInput, actorId: string) {
  const limit = maxBytesFor(input.kind);
  if (input.sizeBytes > limit) {
    throw new DomainError(
      "FILE_TOO_LARGE",
      `Ukuran maksimal ${Math.round(limit / 1024 / 1024)} MB untuk berkas ini.`,
    );
  }

  try {
    assertAccepted(input.kind, input.mimeType, input.originalName);
  } catch (error) {
    throw new DomainError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Berkas tidak diterima.",
    );
  }

  const extension = extensionOf(input.originalName);
  const key = `projects/${input.projectId}/${input.kind.toLowerCase()}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;

  const file = await withTransaction(async (tx) => {
    const created = await tx.fileObject.create({
      data: {
        projectId: input.projectId,
        kind: input.kind,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        key,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        status: "PENDING",
        uploadedById: actorId,
      },
    });
    await writeAudit(tx, {
      actorId,
      projectId: input.projectId,
      entityType: "FileObject",
      entityId: created.id,
      action: "CREATE",
      after: { key: created.key, kind: created.kind, status: created.status },
    });
    return created;
  });

  return {
    fileId: file.id,
    key: file.key,
    url: await presignUpload(file.key, file.mimeType),
    expiresInSeconds: uploadUrlTtlSeconds,
  };
}

/** docs/04 §9: konfirmasi mengecek objek benar-benar ada sebelum status READY. */
export async function confirmUpload(fileId: string, actorId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new DomainError("NOT_FOUND", "Berkas tidak ditemukan.");
  if (file.status === "READY") return { id: file.id, status: file.status };

  const object = await statObject(file.key);
  if (!object) {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "Berkas belum terunggah ke penyimpanan. Ulangi unggah.",
    );
  }

  return withTransaction(async (tx) => {
    const updated = await tx.fileObject.update({
      where: { id: file.id },
      data: { status: "READY", sizeBytes: object.sizeBytes },
    });
    await writeAudit(tx, {
      actorId,
      projectId: updated.projectId,
      entityType: "FileObject",
      entityId: updated.id,
      action: "UPDATE",
      before: { status: file.status },
      after: { status: updated.status, sizeBytes: updated.sizeBytes },
    });
    return { id: updated.id, status: updated.status };
  });
}

export async function createDownloadUrl(fileId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new DomainError("NOT_FOUND", "Berkas tidak ditemukan.");
  if (file.status !== "READY") {
    throw new DomainError(
      "PRECONDITION_FAILED",
      "Berkas belum selesai diunggah sehingga belum bisa diunduh.",
    );
  }
  return {
    url: await presignDownload(file.key),
    expiresInSeconds: downloadUrlTtlSeconds,
    originalName: file.originalName,
  };
}

/**
 * AC-62 dan docs/03 §4: berkas PENDING lebih dari 24 jam dihapus dari bucket dan database.
 * Dipanggil workflow harian; tidak dijalankan otomatis oleh aplikasi.
 */
export async function deleteStalePendingFiles(now = new Date()) {
  const cutoff = new Date(
    now.getTime() - PENDING_MAX_AGE_HOURS * 60 * 60 * 1000,
  );
  const stale = await prisma.fileObject.findMany({
    where: { status: "PENDING", uploadedAt: { lt: cutoff } },
    select: { id: true, key: true },
  });

  let deleted = 0;
  for (const file of stale) {
    await removeObject(file.key);
    const result = await prisma.fileObject.deleteMany({
      where: { id: file.id, status: "PENDING" },
    });
    deleted += result.count;
  }
  return { deleted, cutoff };
}
