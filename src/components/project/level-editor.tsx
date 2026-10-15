"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  attemptId: string;
  version: number;
  positionIds: string[];
  positions: { id: string; name: string }[];
  differsFromMatrix: boolean;
};

/**
 * AC-19: level boleh ditambah, dihapus, dan digeser selama DRAFT; UI menandai daftar yang
 * sudah berbeda dari matriks. Urutan memakai tombol agar dapat dipakai keyboard (D-51).
 */
export function LevelEditor({
  attemptId,
  version,
  positionIds,
  positions,
  differsFromMatrix,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(positionIds);
  const [busy, setBusy] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(target, 0, item);
    setRows(next);
  }

  async function save() {
    if (rows.length === 0) {
      toast.error("Isi minimal satu jabatan approver.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/afce-attempts/${attemptId}/levels`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, positionIds: rows }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(body.error?.message ?? "Level gagal disimpan.");
        return;
      }
      toast.success("Level approval disimpan");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label>Urutan jabatan approver</Label>
        {differsFromMatrix ? (
          <span className="rounded bg-ews-yellow-soft px-2 py-0.5 text-xs text-ews-yellow">
            berbeda dari matriks
          </span>
        ) : null}
      </div>

      <ol className="flex flex-col gap-1 text-sm">
        {rows.map((positionId, index) => (
          <li
            key={`${positionId}-${index}`}
            className="flex items-center gap-2"
          >
            <span className="w-5 text-ink-muted tabular-nums">{index + 1}</span>
            <span>
              {positions.find((position) => position.id === positionId)?.name ??
                positionId}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              Naik
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              Turun
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows(rows.filter((_, row) => row !== index))}
            >
              Hapus
            </Button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded border bg-panel px-2 text-sm"
          value=""
          onChange={(event) => {
            if (event.target.value) setRows([...rows, event.target.value]);
          }}
          aria-label="Tambah jabatan approver"
        >
          <option value="">Tambah jabatan</option>
          {positions
            .filter((position) => !rows.includes(position.id))
            .map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
        </select>
        <Button type="button" onClick={save} disabled={busy}>
          Simpan level
        </Button>
      </div>
    </div>
  );
}
