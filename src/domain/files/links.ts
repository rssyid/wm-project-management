import type { Tx } from "@/infra/tx";
import { DomainError } from "@/shared/errors";
import type { FileKind } from "@/shared/file";

/**
 * docs/03 §4: integritas pemilik FileObject dijaga service. Berkas diunggah lebih dulu
 * (presigned URL) lalu dikaitkan ke pemiliknya di sini, sehingga id berkas yang dikirim
 * formulir tidak bisa menunjuk berkas milik proyek lain.
 */
export async function attachFiles(
  tx: Tx,
  options: {
    fileIds: readonly string[];
    projectId: string;
    ownerType: string;
    ownerId: string;
    expectedKind: FileKind;
  },
): Promise<void> {
  if (options.fileIds.length === 0) return;

  const files = await tx.fileObject.findMany({
    where: { id: { in: [...options.fileIds] } },
    select: {
      id: true,
      projectId: true,
      status: true,
      kind: true,
      originalName: true,
    },
  });
  const byId = new Map(files.map((file) => [file.id, file]));

  for (const fileId of options.fileIds) {
    const file = byId.get(fileId);
    if (!file) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Salah satu berkas tidak ditemukan. Unggah ulang berkas tersebut.",
      );
    }
    if (file.projectId !== options.projectId) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Berkas ${file.originalName} bukan milik proyek ini.`,
      );
    }
    if (file.kind !== options.expectedKind) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `Berkas ${file.originalName} tidak sesuai jenis isian.`,
      );
    }
    if (file.status !== "READY") {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Unggahan ${file.originalName} belum selesai. Coba lagi.`,
      );
    }
  }

  await tx.fileObject.updateMany({
    where: { id: { in: [...options.fileIds] } },
    data: { ownerType: options.ownerType, ownerId: options.ownerId },
  });
}

/** Pembacaan berkas bisa memakai Prisma langsung maupun transaksi; hanya butuh delegate fileObject. */
type FileClient = { fileObject: Tx["fileObject"] };

export async function listOwnerFiles(
  client: FileClient,
  ownerType: string,
  ownerId: string,
) {
  return client.fileObject.findMany({
    where: { ownerType, ownerId },
    select: {
      id: true,
      kind: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
    },
    orderBy: { uploadedAt: "asc" },
  });
}
