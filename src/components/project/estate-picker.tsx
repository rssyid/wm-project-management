"use client";

import { Label } from "@/components/ui/label";

import type { FormEstate } from "./project-form";

export type EstateSelection = { id: string; estateId: string; blockId: string };

type Props = {
  estates: FormEstate[];
  selection: EstateSelection[];
  primaryEstateId: string;
  onToggle: (estateId: string, checked: boolean) => void;
  onBlockChange: (index: number, blockId: string) => void;
  onPrimaryChange: (estateId: string) => void;
  error?: string;
  primaryError?: string;
};

/**
 * AC-11: Estate bisa banyak, tepat satu ditandai utama, dan tiap Estate boleh punya satu
 * Block. Pilihan berasal dari Estate milik Company terpilih, jadi form tidak melakukan
 * request tambahan.
 */
export function EstatePicker({
  estates,
  selection,
  primaryEstateId,
  onToggle,
  onBlockChange,
  onPrimaryChange,
  error,
  primaryError,
}: Props) {
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Estate proyek</legend>
        {estates.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Pilih Company lebih dulu untuk melihat Estate.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {estates.map((estate) => (
              <label
                key={estate.id}
                className="flex items-center gap-2 rounded border bg-panel px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selection.some((row) => row.estateId === estate.id)}
                  onChange={(event) =>
                    onToggle(estate.id, event.target.checked)
                  }
                />
                {estate.code} · {estate.name}
              </label>
            ))}
          </div>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </fieldset>

      {selection.map((row, index) => {
        const estate = estates.find((item) => item.id === row.estateId);
        if (!estate) return null;
        return (
          <div key={row.id} className="rounded border bg-panel p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {estate.code} · {estate.name}
              </span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="primaryEstateId"
                  value={estate.id}
                  checked={primaryEstateId === estate.id}
                  onChange={() => onPrimaryChange(estate.id)}
                />
                Estate utama
              </label>
            </div>
            {estate.blocks.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1">
                <Label htmlFor={`block-${row.id}`}>Block (opsional)</Label>
                <select
                  id={`block-${row.id}`}
                  value={row.blockId}
                  onChange={(event) => onBlockChange(index, event.target.value)}
                  className="h-9 w-full rounded border bg-panel px-2 text-sm"
                >
                  <option value="">Lintas blok</option>
                  {estate.blocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.blockCode} · {block.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        );
      })}
      {primaryError ? (
        <p className="text-xs text-destructive">{primaryError}</p>
      ) : null}
    </>
  );
}
