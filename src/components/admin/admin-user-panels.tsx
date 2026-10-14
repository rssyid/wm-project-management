"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, ROLES, type Role } from "@/shared/role";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/shared/schemas/user";

import type { AdminUserRow } from "./admin-user-types";

/** docs/02 §1: mutasi lewat fetch ke /api, lalu halaman disegarkan router.refresh(). */
async function submitJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    toast.error(payload.error?.message ?? "Data gagal disimpan.");
    return false;
  }
  return true;
}

export function CreateUserPanel({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "MANAGEMENT_VIEWER",
      temporaryPassword: "",
    },
  });

  return (
    <PanelShell title="Tambah user" ariaLabel="Tambah user">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (values) => {
          if (!(await submitJson("/api/users", "POST", values))) return;
          toast.success("User dibuat");
          onSaved();
          onClose();
        })}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nama</Label>
          <Input id="name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <RoleSelect
          defaultValue="MANAGEMENT_VIEWER"
          onChange={(value) => setValue("role", value)}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="temporaryPassword">Password sementara</Label>
          <Input
            id="temporaryPassword"
            type="text"
            autoComplete="off"
            {...register("temporaryPassword")}
          />
          {errors.temporaryPassword?.message ? (
            <FieldError message={errors.temporaryPassword.message} />
          ) : (
            <p className="text-dense text-ink-muted">
              Minimal 8 karakter. User wajib menggantinya saat login pertama.
            </p>
          )}
        </div>
        <PanelActions
          onClose={onClose}
          isSubmitting={isSubmitting}
          label="Simpan user"
        />
      </form>
    </PanelShell>
  );
}

export function EditUserPanel({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name, role: user.role as Role },
  });

  return (
    <PanelShell title={`Ubah ${user.name}`} ariaLabel={`Ubah ${user.name}`}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (values) => {
          if (!(await submitJson(`/api/users/${user.id}`, "PATCH", values)))
            return;
          toast.success("User diperbarui");
          onSaved();
          onClose();
        })}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nama</Label>
          <Input id="name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <RoleSelect
          defaultValue={user.role}
          onChange={(value) => setValue("role", value)}
        />
        <PanelActions
          onClose={onClose}
          isSubmitting={isSubmitting}
          label="Simpan perubahan"
        />
      </form>
    </PanelShell>
  );
}

function PanelShell({
  title,
  ariaLabel,
  children,
}: {
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={ariaLabel}
      className="mt-4 w-full max-w-[420px] rounded-lg border bg-panel p-4"
    >
      <h2 className="mb-4 text-base font-semibold text-ink">{title}</h2>
      {children}
    </aside>
  );
}

function RoleSelect({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange: (value: Role) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="role">Peran</Label>
      <select
        id="role"
        defaultValue={defaultValue}
        onChange={(event) => onChange(event.target.value as Role)}
        className="h-9 w-full rounded border bg-panel px-2 text-sm"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-dense text-destructive">{message}</p>;
}

function PanelActions({
  onClose,
  isSubmitting,
  label,
}: {
  onClose: () => void;
  isSubmitting: boolean;
  label: string;
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Menyimpan…" : label}
      </Button>
      <Button type="button" variant="outline" onClick={onClose}>
        Batal
      </Button>
    </div>
  );
}
