"use client";

import { ProjectStatusBadge } from "@/components/project-badges";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/shared/format";
import {
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/shared/project-status";

export type ProjectListRow = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  company: { id: string; code: string; name: string };
  category: { id: string; name: string };
  mainEstate: { code: string; name: string; wilayah: string } | null;
  otherEstateCount: number;
  plannedBudget: string | null;
  pic: string | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
};

const columns: DataTableColumn<ProjectListRow>[] = [
  {
    accessorKey: "code",
    header: "Kode",
    cell: ({ row }) => (
      <a
        href={`/proyek/${row.original.code}`}
        className="text-canal hover:underline"
      >
        {row.original.code}
      </a>
    ),
  },
  { accessorKey: "name", header: "Nama" },
  {
    accessorKey: "category",
    header: "Kategori",
    cell: ({ row }) => row.original.category.name,
  },
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => row.original.company.name,
  },
  {
    accessorKey: "estate",
    header: "Estate",
    cell: ({ row }) =>
      row.original.mainEstate
        ? `${row.original.mainEstate.code}${
            row.original.otherEstateCount > 0
              ? ` +${row.original.otherEstateCount}`
              : ""
          }`
        : "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "pic",
    header: "PIC",
    cell: ({ row }) => row.original.pic ?? "—",
  },
  {
    accessorKey: "targetEndDate",
    header: "Target selesai",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.targetEndDate
          ? formatDate(new Date(row.original.targetEndDate))
          : "—"}
      </span>
    ),
  },
];

/**
 * D-20 dan docs/05 §5: tabel di 768 px ke atas, di bawahnya daftar ringkas berisi nama, kode,
 * status, dan anggaran utama. Progres dan EWS menyusul F4 bersama service progress-ews.
 */
export function ProjectTable({ rows }: { rows: ProjectListRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      caption="Daftar proyek"
      empty={
        <EmptyState message="Belum ada proyek yang cocok dengan filter." />
      }
      renderMobileRow={(row) => (
        <div className="flex flex-col gap-1">
          <a
            href={`/proyek/${row.code}`}
            className="text-sm font-medium text-canal hover:underline"
          >
            {row.name}
          </a>
          <p className="text-xs text-ink-muted">
            {row.code} · {row.company.name} · {PROJECT_STATUS_LABEL[row.status]}
          </p>
        </div>
      )}
    />
  );
}
