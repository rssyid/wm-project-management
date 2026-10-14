"use client";

import { MoreHorizontal, KeyRound, Pencil, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL, type Role } from "@/shared/role";

import { CreateUserPanel, EditUserPanel } from "./admin-user-panels";
import { ResetPasswordDialog } from "./admin-user-reset-dialog";
import type { AdminUserRow } from "./admin-user-types";

/** docs/05 §10: tabel user dengan panel ubah di samping, bukan grid kartu. */
export function AdminUserView({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);

  function refresh() {
    router.refresh();
  }

  async function toggleActive(row: AdminUserRow) {
    const response = await fetch(`/api/users/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Status gagal diubah.");
      return;
    }
    toast.success(row.isActive ? "User dinonaktifkan" : "User diaktifkan");
    refresh();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>Tambah user</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-panel">
        <table className="w-full text-dense" aria-label="Daftar user">
          <thead className="bg-surface">
            <tr>
              {["Nama", "Email", "Peran", "Password", "Status"].map(
                (header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-3 py-2 text-left font-medium text-ink-muted"
                  >
                    {header}
                  </th>
                ),
              )}
              <th
                scope="col"
                className="w-10 px-3 py-2 text-right font-medium text-ink-muted"
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="h-10 border-t hover:bg-canal-soft">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.email}</td>
                <td className="px-3 py-2">
                  {ROLE_LABEL[row.role as Role] ?? row.role}
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {row.mustChangePassword ? "Belum diganti" : "Sudah diganti"}
                </td>
                <td className="px-3 py-2">
                  {row.isActive ? (
                    <span className="text-ews-green">Aktif</span>
                  ) : (
                    <span className="text-ink-muted">Nonaktif</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Aksi ${row.name}`}
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(row)}>
                        <Pencil aria-hidden="true" />
                        Ubah
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setResetting(row)}>
                        <KeyRound aria-hidden="true" />
                        Reset password
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={row.id === currentUserId}
                        onSelect={() => void toggleActive(row)}
                      >
                        <Power aria-hidden="true" />
                        {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating ? (
        <CreateUserPanel onClose={() => setCreating(false)} onSaved={refresh} />
      ) : null}

      {editing ? (
        <EditUserPanel
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}

      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onSaved={refresh}
      />
    </>
  );
}
