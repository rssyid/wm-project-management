"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/shared/schemas/user";

import type { AdminUserRow } from "./admin-user-types";

/** docs/04 §11 dan AC-04: reset mencabut semua session user tersebut. */
export function ResetPasswordDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { temporaryPassword: "" },
  });

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password {user?.name ?? ""}</DialogTitle>
          <DialogDescription>
            Sampaikan password baru ke user. Semua session user ini langsung
            dicabut dan ia wajib mengganti password saat login berikutnya.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={handleSubmit(async (values) => {
            if (!user) return;
            const response = await fetch(
              `/api/users/${user.id}/reset-password`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(values),
              },
            );
            if (!response.ok) {
              const body = (await response.json()) as {
                error?: { message?: string };
              };
              toast.error(body.error?.message ?? "Password gagal direset.");
              return;
            }
            toast.success("Password direset");
            onSaved();
            onClose();
          })}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="temporaryPassword">Password sementara</Label>
            <Input
              id="temporaryPassword"
              type="text"
              autoComplete="off"
              {...register("temporaryPassword")}
            />
            {errors.temporaryPassword?.message ? (
              <p className="text-dense text-destructive">
                {errors.temporaryPassword.message}
              </p>
            ) : (
              <p className="text-dense text-ink-muted">Minimal 8 karakter.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan…" : "Reset password"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
