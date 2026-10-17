"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CancelType = "pekerjaan" | "spk" | "paket" | "attempt";

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CancelType;
  id: string;
  version: number;
  onSuccess: () => void;
}

const TYPE_LABEL: Record<CancelType, string> = {
  pekerjaan: "Pekerjaan",
  spk: "SPK",
  paket: "Paket Kerja",
  attempt: "Tender Attempt",
};

const TYPE_PATH: Record<CancelType, string> = {
  pekerjaan: "work-items",
  spk: "spks",
  paket: "work-packages",
  attempt: "tender-attempts",
};

export function CancelDialog({
  open,
  onOpenChange,
  type,
  id,
  version,
  onSuccess,
}: CancelDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      const response = await fetch(`/api/${TYPE_PATH[type]}/${id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, reason }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        toast.error(payload.error?.message ?? "Aksi gagal dijalankan.");
        return false;
      }
      toast.success(`${TYPE_LABEL[type]} dibatalkan`);
      onSuccess();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan {TYPE_LABEL[type]}</DialogTitle>
          <DialogDescription>
            Masukkan alasan pembatalan {TYPE_LABEL[type].toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <Label>Alasan</Label>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Alasan pembatalan…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              const ok = await handleCancel();
              if (ok) onOpenChange(false);
            }}
          >
            Batalkan {TYPE_LABEL[type]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
