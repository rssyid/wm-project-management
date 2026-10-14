/**
 * Mirror enum Prisma `FileKind` (dipakai di klien, sehingga tidak boleh mengimpor Prisma).
 * docs/03 §4: batas ukuran foto 5 MB, lampiran lain 10 MB, data spasial hanya zip dan geojson.
 */
export const FILE_KINDS = [
  "PROGRESS_PHOTO",
  "APPROVAL_EVIDENCE",
  "BAST",
  "DOCUMENT",
  "SPATIAL_DATA",
] as const;

export type FileKind = (typeof FILE_KINDS)[number];

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** Foto dan bukti approval dikirim dari ponsel, jadi memakai batas 5 MB. */
const PHOTO_KINDS: FileKind[] = ["PROGRESS_PHOTO", "APPROVAL_EVIDENCE"];

const SPATIAL_MIME_TYPES: Record<string, string> = {
  zip: "application/zip",
  geojson: "application/geo+json",
};

export function maxBytesFor(kind: FileKind): number {
  return PHOTO_KINDS.includes(kind) ? PHOTO_MAX_BYTES : DEFAULT_MAX_BYTES;
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

/** MIME dan ekstensi harus cocok; data spasial hanya boleh zip atau geojson. */
export function assertAccepted(
  kind: FileKind,
  mimeType: string,
  name: string,
): void {
  const extension = extensionOf(name);
  if (kind === "SPATIAL_DATA") {
    if (SPATIAL_MIME_TYPES[extension] !== mimeType) {
      throw new Error("Data spasial hanya boleh .zip atau .geojson.");
    }
    return;
  }
  if (PHOTO_KINDS.includes(kind)) {
    if (!mimeType.startsWith("image/")) {
      throw new Error("Foto harus berupa berkas gambar.");
    }
    return;
  }
  if (!mimeType.startsWith("image/") && !mimeType.startsWith("application/")) {
    throw new Error("Tipe berkas tidak dikenali.");
  }
}
