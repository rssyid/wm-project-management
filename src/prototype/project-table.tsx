"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { EwsBadge, ProjectStatusBadge } from "@/components/project-badges";
import { formatDate, formatPercent } from "@/shared/format";

import type { SampleProject } from "./sample-data";

const columns: ReadonlyArray<DataTableColumn<SampleProject>> = [
  {
    id: "code",
    header: "Kode",
    cell: ({ row }) => (
      <Link href={`/proyek/${row.original.code}`} className="font-medium text-canal hover:underline">
        {row.original.code}
      </Link>
    ),
  },
  { id: "name", header: "Nama", cell: ({ row }) => row.original.name },
  {
    id: "estate",
    header: "Estate utama",
    cell: ({ row }) =>
      row.original.extraEstates > 0
        ? `${row.original.mainEstate} (+${row.original.extraEstates})`
        : row.original.mainEstate,
  },
  { id: "status", header: "Status", cell: ({ row }) => <ProjectStatusBadge status={row.original.status} /> },
  {
    id: "progress",
    header: "Progres",
    meta: { align: "right" },
    cell: ({ row }) => formatPercent(row.original.progress),
  },
  {
    id: "ews",
    header: "EWS",
    cell: ({ row }) => <EwsBadge level={row.original.ews.level} deviation={row.original.ews.deviation} />,
  },
  { id: "pic", header: "PIC", cell: ({ row }) => row.original.pic },
  {
    id: "targetEnd",
    header: "Target selesai",
    meta: { align: "right" },
    cell: ({ row }) => formatDate(new Date(row.original.targetEnd)),
  },
];

export function ProjectTable({ projects, caption }: { projects: readonly SampleProject[]; caption: string }) {
  return (
    <DataTable
      caption={caption}
      columns={columns}
      data={projects}
      getRowId={(project) => project.code}
      empty={<EmptyState message="Belum ada proyek yang cocok dengan filter." />}
      renderMobileRow={(project) => (
        <Link href={`/proyek/${project.code}`} className="flex flex-col gap-1">
          <span className="font-medium text-ink">{project.name}</span>
          <span className="text-xs text-ink-muted">{project.code}</span>
          <span className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <span className="text-dense tabular-nums">{formatPercent(project.progress)}</span>
          </span>
        </Link>
      )}
    />
  );
}
