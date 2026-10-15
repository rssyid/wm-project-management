"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TierView = {
  id: string;
  name: string;
  forAfce: boolean;
  forArSupplement: boolean;
  minAmount: string | null;
  maxAmount: string | null;
  isActive: boolean;
  version: number;
  levels: {
    id: string;
    levelNo: number;
    position: { id: string; name: string };
  }[];
};

/**
 * AC-03: hanya Super Admin yang managing matriks. Urutan jabatan memakai tombol naik/turun
 * supaya dapat dipakai keyboard (D-51).
 */
export function ApprovalTierEditor({
  tiers,
  positions,
}: {
  tiers: TierView[];
  positions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [minAmount, setMinAmount] = useState("0");
  const [maxAmount, setMaxAmount] = useState("");
  const [forAfce, setForAfce] = useState(true);
  const [forArSupplement, setForArSupplement] = useState(true);
  const [rows, setRows] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save(method: "POST" | "PATCH", path: string, body: unknown) {
    setBusy(true);
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        toast.error(payload.error?.message ?? "Tier gagal disimpan.");
        return false;
      }
      toast.success("Tier matriks disimpan");
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(target, 0, item);
    setRows(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-ink-muted">
            <th className="py-1">Tier</th>
            <th className="py-1">Rentang</th>
            <th className="py-1">Untuk</th>
            <th className="py-1">Level</th>
            <th className="py-1">Status</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.id} className="border-b align-top">
              <td className="py-2 pr-2">{tier.name}</td>
              <td className="py-2 pr-2 tabular-nums">
                {tier.minAmount} – {tier.maxAmount ?? "tak terbatas"}
              </td>
              <td className="py-2 pr-2">
                {tier.forAfce ? "AFCE" : ""}
                {tier.forAfce && tier.forArSupplement ? ", " : ""}
                {tier.forArSupplement ? "AR" : ""}
              </td>
              <td className="py-2 pr-2">
                {tier.levels.map((level) => level.position.name).join(" → ")}
              </td>
              <td className="py-2 pr-2">
                {tier.isActive ? "Aktif" : "Nonaktif"}
              </td>
              <td className="py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    save("PATCH", `/api/approval-tiers/${tier.id}`, {
                      version: tier.version,
                      name: tier.name,
                      forAfce: tier.forAfce,
                      forArSupplement: tier.forArSupplement,
                      minAmount: tier.minAmount,
                      maxAmount: tier.maxAmount,
                      positionIds: tier.levels.map(
                        (level) => level.position.id,
                      ),
                      isActive: !tier.isActive,
                    })
                  }
                >
                  {tier.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open ? (
        <div className="flex max-w-[720px] flex-col gap-3 rounded border bg-panel p-4">
          <Field label="Nama tier">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Batas bawah">
              <Input
                inputMode="decimal"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
              />
            </Field>
            <Field label="Batas atas (kosong = tanpa batas)">
              <Input
                inputMode="decimal"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forAfce}
                onChange={(event) => setForAfce(event.target.checked)}
              />
              Dipakai untuk AFCE
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forArSupplement}
                onChange={(event) => setForArSupplement(event.target.checked)}
              />
              Dipakai untuk AR tambahan
            </label>
          </div>

          <Field label="Urutan jabatan approver">
            <ol className="flex flex-col gap-1">
              {rows.map((positionId, index) => (
                <li
                  key={`${positionId}-${index}`}
                  className="flex items-center gap-2"
                >
                  <span className="w-5 text-ink-muted tabular-nums">
                    {index + 1}
                  </span>
                  <span>
                    {positions.find((position) => position.id === positionId)
                      ?.name ?? positionId}
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
                    onClick={() =>
                      setRows(rows.filter((_, row) => row !== index))
                    }
                  >
                    Hapus
                  </Button>
                </li>
              ))}
            </ol>
            <select
              className="mt-2 h-9 rounded border bg-panel px-2 text-sm"
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
          </Field>

          <div className="flex gap-2">
            <Button
              disabled={busy || name.trim().length === 0 || rows.length === 0}
              onClick={async () => {
                const ok = await save("POST", "/api/approval-tiers", {
                  name,
                  forAfce,
                  forArSupplement,
                  minAmount,
                  maxAmount: maxAmount || null,
                  positionIds: rows,
                });
                if (ok) setOpen(false);
              }}
            >
              Simpan tier
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Tambah tier
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
