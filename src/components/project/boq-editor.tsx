"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BoqRow = {
  id: string;
  lineNo: number;
  buildingName: string | null;
  activityName: string;
  amount: string | null;
};

type Props = {
  attemptId: string;
  version: number;
  items: BoqRow[];
};

type DraftRow = { buildingName: string; activityName: string; amount: string };

/**
 * AC-17: nilai AFCE dihitung ulang di server dari baris yang dikirim; tabel di bawah hanya
 * menampilkan total dari nilai AFCE, bukan menghitung ulang.
 */
export function BoqEditor({ attemptId, version, items }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>(
    items.map((item) => ({
      buildingName: item.buildingName ?? "",
      activityName: item.activityName,
      amount: item.amount ?? "0",
    })),
  );
  const [busy, setBusy] = useState(false);

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/afce-attempts/${attemptId}/boq`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version,
          items: rows
            .filter((row) => row.activityName.trim().length > 0)
            .map((row) => ({
              buildingName: row.buildingName || null,
              activityName: row.activityName,
              amount: row.amount || "0",
              notes: null,
            })),
        }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(body.error?.message ?? "BOQ gagal disimpan.");
        return;
      }
      toast.success("BOQ disimpan");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-ink-muted">
            <th className="py-1">Bangunan</th>
            <th className="py-1">Kegiatan</th>
            <th className="py-1 text-right">Harga</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b">
              <td className="py-1 pr-2">
                <Input
                  value={row.buildingName}
                  onChange={(event) =>
                    updateRow(index, { buildingName: event.target.value })
                  }
                  aria-label={`Bangunan baris ${index + 1}`}
                />
              </td>
              <td className="py-1 pr-2">
                <Input
                  value={row.activityName}
                  onChange={(event) =>
                    updateRow(index, { activityName: event.target.value })
                  }
                  aria-label={`Kegiatan baris ${index + 1}`}
                />
              </td>
              <td className="py-1">
                <Input
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(event) =>
                    updateRow(index, { amount: event.target.value })
                  }
                  aria-label={`Harga baris ${index + 1}`}
                  className="text-right"
                />
              </td>
              <td className="py-1 pl-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setRows(rows.filter((_, row) => row !== index))
                  }
                >
                  Hapus
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setRows([
              ...rows,
              { buildingName: "", activityName: "", amount: "0" },
            ])
          }
        >
          Tambah baris
        </Button>
        <Button type="button" onClick={save} disabled={busy}>
          Simpan BOQ
        </Button>
      </div>
    </div>
  );
}
