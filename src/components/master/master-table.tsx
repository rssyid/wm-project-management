"use client";

import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  MASTER_COLUMNS,
  hasCompleteFlag,
} from "@/app/(app)/master/master-config";
import { pick, type MasterListItem } from "@/app/(app)/master/row";
import type { MasterType } from "@/shared/location";

import type { MasterViewProps } from "./types";

type Props = Pick<MasterViewProps, "type" | "rows" | "canWrite"> & {
  onEdit: (row: MasterListItem) => void;
  onChanged: () => void;
};

export function MasterTable({
  type,
  rows,
  canWrite,
  onEdit,
  onChanged,
}: Props) {
  const columns = MASTER_COLUMNS[type];
  const [target, setTarget] = useState<MasterListItem | null>(null);

  return (
    <div className="rounded-lg border bg-panel">
      {/* D-20: di bawah 768 px tabel diganti daftar ringkas supaya tidak perlu geser horizontal. */}
      <ul className="divide-y md:hidden" aria-label={`Daftar ${type}`}>
        {rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-dense text-ink-muted">
            Belum ada data. Ubah filter atau tambahkan data baru.
          </li>
        ) : (
          rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {String(pick(row, columns[0]?.source ?? "name") ?? "—")}
                </p>
                <p className="truncate text-dense text-ink-muted">
                  {String(pick(row, columns[1]?.source ?? "name") ?? "—")}
                </p>
                <p className="text-dense">
                  {row.isActive ? (
                    <span className="text-ews-green">Aktif</span>
                  ) : (
                    <span className="text-ink-muted">Nonaktif</span>
                  )}
                </p>
              </div>
              {canWrite ? (
                <RowActions
                  type={type}
                  row={row}
                  onEdit={() => onEdit(row)}
                  onDelete={() => setTarget(row)}
                  onChanged={onChanged}
                />
              ) : null}
            </li>
          ))
        )}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-dense" aria-label={type}>
          <thead className="bg-surface">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-3 py-2 font-medium text-ink-muted ${column.numeric ? "text-right" : "text-left"}`}
                >
                  {column.header}
                </th>
              ))}
              {canWrite ? (
                <th
                  scope="col"
                  className="w-10 px-3 py-2 text-right font-medium text-ink-muted"
                >
                  Aksi
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (canWrite ? 1 : 0)}
                  className="px-3 py-6 text-center text-ink-muted"
                >
                  Belum ada data. Ubah filter atau tambahkan data baru.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="h-10 border-t hover:bg-canal-soft">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 ${column.numeric ? "text-right tabular-nums" : ""}`}
                    >
                      <Cell type={type} row={row} source={column.source} />
                    </td>
                  ))}
                  {canWrite ? (
                    <td className="px-3 py-2 text-right">
                      <RowActions
                        type={type}
                        row={row}
                        onEdit={() => onEdit(row)}
                        onDelete={() => setTarget(row)}
                        onChanged={onChanged}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteDialog
        row={target}
        type={type}
        onClose={() => setTarget(null)}
        onChanged={onChanged}
      />
    </div>
  );
}

function Cell({
  type,
  row,
  source,
}: {
  type: MasterType;
  row: MasterListItem;
  source: string;
}) {
  const value = pick(row, source);
  if (source === "isActive") {
    return row.isActive ? (
      <span className="text-ews-green">Aktif</span>
    ) : (
      <span className="text-ink-muted">Nonaktif</span>
    );
  }
  if (source === "isComplete" && hasCompleteFlag(type)) {
    return (
      <span className={row.isComplete ? "" : "text-ews-yellow"}>
        {row.isComplete ? "Lengkap" : "Belum lengkap"}
      </span>
    );
  }
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function RowActions({
  type,
  row,
  onEdit,
  onDelete,
  onChanged,
}: {
  type: MasterType;
  row: MasterListItem;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const response = await fetch(`/api/master/${type}/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    setBusy(false);
    if (!response.ok) {
      toast.error("Perubahan gagal disimpan.");
      return;
    }
    toast.success(row.isActive ? "Data dinonaktifkan" : "Data diaktifkan");
    onChanged();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-label={`Aksi ${row.name ?? row.id}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" />
          Ubah
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void toggleActive()}>
          <Power aria-hidden="true" />
          {row.isActive ? "Nonaktifkan" : "Aktifkan"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteDialog({
  row,
  type,
  onClose,
  onChanged,
}: {
  row: MasterListItem | null;
  type: MasterType;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!row) return;
    setBusy(true);
    const response = await fetch(`/api/master/${type}/${row.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Data tidak bisa dihapus.");
      onClose();
      return;
    }
    toast.success("Data dihapus");
    onClose();
    onChanged();
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus {String(row?.name ?? "")}</DialogTitle>
          <DialogDescription>
            Data yang sudah dipakai tidak bisa dihapus; nonaktifkan saja. Hapus
            tidak dapat dibatalkan karena tercatat di riwayat.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => void remove()}
            disabled={busy}
          >
            {busy ? "Menghapus…" : "Hapus data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
