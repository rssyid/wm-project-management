"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

import { MasterPanel } from "./master-panel";
import { MasterTable } from "./master-table";
import type { MasterListItem, OptionItem } from "@/app/(app)/master/row";
import type { MasterViewProps } from "./types";

/**
 * docs/05 §10: bar filter satu baris, tabel penuh di panel berborder, panel ubah di samping.
 * Data dibaca lewat Server Component; mutasi lewat fetch ke /api lalu router.refresh().
 */
export function MasterView({
  type,
  label,
  rows,
  options,
  hasVersion,
  canWrite,
  filters,
}: MasterViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<MasterListItem | null | undefined>(
    undefined,
  );

  function refresh() {
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={label}
        description={`${rows.length} data`}
        actions={
          canWrite ? (
            <Button onClick={() => setEditing(null)}>
              Tambah {label.toLowerCase()}
            </Button>
          ) : null
        }
      />

      <MasterFiltersBar type={type} filters={filters} options={options} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <MasterTable
            type={type}
            rows={rows}
            canWrite={canWrite}
            onEdit={setEditing}
            onChanged={refresh}
          />
        </div>
        {editing !== undefined && canWrite ? (
          <MasterPanel
            type={type}
            row={editing}
            hasVersion={hasVersion}
            options={options}
            onClose={() => setEditing(undefined)}
            onSaved={refresh}
          />
        ) : null}
      </div>
    </>
  );
}

function MasterFiltersBar({
  type,
  filters,
  options,
}: {
  type: MasterViewProps["type"];
  filters: MasterViewProps["filters"];
  options: MasterViewProps["options"];
}) {
  return (
    <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-dense text-ink-muted">Cari</span>
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Nama atau kode"
          className="h-9 w-56 rounded border bg-panel px-3 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-dense text-ink-muted">Status</span>
        <select
          name="active"
          defaultValue={
            filters.active === undefined ? "" : String(filters.active)
          }
          className="h-9 rounded border bg-panel px-2 text-sm"
        >
          <option value="">Semua</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </label>

      {type === "wilayah" ? (
        <RegionSelect options={options.regions ?? []} />
      ) : null}
      {type === "estates" ? (
        <>
          <RegionSelect options={options.regions ?? []} />
          <IdSelect
            name="companyId"
            label="Company"
            options={options.companies ?? []}
          />
          <IdSelect
            name="wilayahId"
            label="Wilayah"
            options={options.wilayah ?? []}
          />
        </>
      ) : null}
      {type === "blocks" ? (
        <IdSelect
          name="estateId"
          label="Estate"
          options={options.estates ?? []}
        />
      ) : null}

      <Button type="submit" variant="outline">
        Saring
      </Button>
      <a
        href={`/master/${type}`}
        className="flex h-9 items-center text-sm text-canal hover:underline"
      >
        Bersihkan filter
      </a>
    </form>
  );
}

function RegionSelect({ options }: { options: OptionItem[] }) {
  return <IdSelect name="regionId" label="Region" options={options} />;
}

function IdSelect({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: OptionItem[];
}) {
  if (options.length === 0) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-dense text-ink-muted">{label}</span>
      <select name={name} className="h-9 rounded border bg-panel px-2 text-sm">
        <option value="">Semua</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
