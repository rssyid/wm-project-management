"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FileKind } from "@/shared/file";

export type UploadedFile = { id: string; originalName: string };

type Props = {
  projectId: string;
  ownerType: string;
  ownerId: string;
  kind: FileKind;
  label: string;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Foto dikompres di browser sebelum diunggah agar tetap di bawah batas 5 MB dari HP di lapangan
 * (docs/01 §8). Berkas lain dikirim apa adanya sampai batas 10 MB.
 */
export function FileUpload({
  projectId,
  ownerType,
  ownerId,
  kind,
  label,
  files,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const inputId = `upload-${kind}-${ownerId}`;

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setBusy(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of Array.from(selected)) {
        const payload = await compressIfPhoto(file);
        const response = await fetch("/api/files/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId,
            ownerType,
            ownerId,
            kind,
            originalName: payload.name,
            mimeType: payload.type,
            sizeBytes: payload.size,
          }),
        });
        const body = (await response.json()) as {
          data?: { fileId: string; url: string };
          error?: { message?: string };
        };
        if (!response.ok || !body.data) {
          toast.error(body.error?.message ?? `Gagal mengunggah ${file.name}.`);
          return;
        }
        const put = await fetch(body.data.url, {
          method: "PUT",
          headers: { "content-type": payload.type },
          body: payload.blob,
        });
        if (!put.ok) {
          toast.error(`Unggahan ${file.name} gagal. Coba lagi.`);
          return;
        }
        const confirm = await fetch(`/api/files/${body.data.fileId}/confirm`, {
          method: "POST",
        });
        if (!confirm.ok) {
          toast.error(`Konfirmasi ${file.name} gagal. Coba lagi.`);
          return;
        }
        uploaded.push({ id: body.data.fileId, originalName: payload.name });
      }
      if (uploaded.length > 0) {
        onChange([...files, ...uploaded]);
        toast.success(`${uploaded.length} berkas diunggah`);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={kind === "SPATIAL_DATA" ? ".zip,.geojson" : undefined}
        disabled={busy}
        onChange={(event) => void handleFiles(event.target.files)}
        className="text-sm"
      />
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-ink-muted">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2">
              <span className="truncate">{file.originalName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange(files.filter((row) => row.id !== file.id))
                }
              >
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type UploadPayload = {
  blob: Blob;
  name: string;
  type: string;
  size: number;
};

/** Foto dari HP sering di atas 5 MB; perkecil sisi terpanjang supaya tetap bisa diunggah. */
async function compressIfPhoto(file: File): Promise<UploadPayload> {
  const original: UploadPayload = {
    blob: file,
    name: file.name,
    type: file.type,
    size: file.size,
  };
  if (!file.type.startsWith("image/") || file.size <= MAX_PHOTO_BYTES) {
    return original;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, Math.sqrt(MAX_PHOTO_BYTES / file.size));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.round(bitmap.width * scale), 1);
  canvas.height = Math.max(Math.round(bitmap.height * scale), 1);
  const context = canvas.getContext("2d");
  if (!context) return original;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, 0.8),
  );
  if (!blob) return original;

  return {
    blob,
    name: file.name.replace(/\.[^.]+$/, type === "image/png" ? ".png" : ".jpg"),
    type,
    size: blob.size,
  };
}
