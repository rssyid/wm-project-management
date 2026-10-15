import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import type { FormOption } from "@/components/project/project-form";
import {
  ProjectTable,
  type ProjectListRow,
} from "@/components/project/project-table";
import { Button } from "@/components/ui/button";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
} from "@/shared/project-status";

type Props = {
  rows: ProjectListRow[];
  total: number;
  page: number;
  pageSize: number;
  canWrite: boolean;
  filters: {
    q: string;
    status: string;
    companyId: string;
    regionId: string;
    categoryId: string;
  };
  options: {
    regions: (FormOption & { code: string })[];
    companies: FormOption[];
    categories: FormOption[];
  };
};

/**
 * docs/05 §5: bar filter satu baris di atas tabel. Filter bekerja lewat query string supaya
 * bisa dibagikan dan tetap terbaca lewat Server Component.
 */
export function ProjectListView({
  rows,
  total,
  page,
  pageSize,
  canWrite,
  filters,
  options,
}: Props) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <PageHeader
        title="Proyek"
        description={`${total} proyek`}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/proyek/baru">
                <Plus aria-hidden="true" />
                Buat proyek
              </Link>
            </Button>
          ) : null
        }
      />

      <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-dense text-ink-muted">Cari</span>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Nama atau kode"
            className="h-9 w-56 rounded border bg-panel px-3 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-dense text-ink-muted">Status</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="h-9 rounded border bg-panel px-2 text-sm"
          >
            <option value="">Semua</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-dense text-ink-muted">Region</span>
          <select
            name="regionId"
            defaultValue={filters.regionId}
            className="h-9 rounded border bg-panel px-2 text-sm"
          >
            <option value="">Semua</option>
            {options.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-dense text-ink-muted">Company</span>
          <select
            name="companyId"
            defaultValue={filters.companyId}
            className="h-9 rounded border bg-panel px-2 text-sm"
          >
            <option value="">Semua</option>
            {options.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-dense text-ink-muted">Kategori</span>
          <select
            name="categoryId"
            defaultValue={filters.categoryId}
            className="h-9 rounded border bg-panel px-2 text-sm"
          >
            <option value="">Semua</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" variant="outline">
          Saring
        </Button>
        <Link
          href="/proyek"
          className="flex h-9 items-center text-sm text-canal hover:underline"
        >
          Bersihkan filter
        </Link>
      </form>

      <ProjectTable rows={rows} />

      {pageCount > 1 ? (
        <nav
          aria-label="Navigasi halaman"
          className="mt-3 flex items-center gap-2"
        >
          {page > 1 ? (
            <Link
              href={`/proyek?${new URLSearchParams({ ...filters, page: String(page - 1) })}`}
              className="text-sm text-canal hover:underline"
            >
              Sebelumnya
            </Link>
          ) : null}
          <span className="text-sm text-ink-muted">
            Halaman {page} dari {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={`/proyek?${new URLSearchParams({ ...filters, page: String(page + 1) })}`}
              className="text-sm text-canal hover:underline"
            >
              Berikutnya
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
