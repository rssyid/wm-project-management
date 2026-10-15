"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayBusinessDateIso } from "@/shared/date";

/**
 * Approval diputuskan di SAP dan dicatat user (docs/01 §6), jadi dialog ini hanya mencatat
 * hasil, nama approver, tanggal SAP, dan catatan.
 */
export function DecisionButtons({
  levelId,
  positionName,
}: {
  levelId: string;
  positionName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [decisionDate, setDecisionDate] = useState(todayBusinessDateIso());
  const [notes, setNotes] = useState("");

  async function submit(result: "APPROVED" | "DITOLAK") {
    setBusy(true);
    try {
      const response = await fetch(`/api/approval-levels/${levelId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result, approverName, decisionDate, notes }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(body.error?.message ?? "Keputusan gagal dicatat.");
        return;
      }
      toast.success(
        result === "APPROVED"
          ? "Keputusan disetujui dicatat"
          : "Penolakan dicatat",
      );
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Catat keputusan {positionName}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border bg-panel p-3">
      <p className="text-sm text-ink-muted">
        Keputusan di SAP, dicatat oleh user.
      </p>
      <Field label="Nama approver">
        <Input
          value={approverName}
          onChange={(event) => setApproverName(event.target.value)}
        />
      </Field>
      <Field label="Tanggal keputusan SAP">
        <Input
          type="date"
          value={decisionDate}
          onChange={(event) => setDecisionDate(event.target.value)}
        />
      </Field>
      <Field label="Catatan">
        <textarea
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded border bg-panel px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || approverName.trim().length === 0}
          onClick={() => submit("APPROVED")}
        >
          Catat disetujui
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || approverName.trim().length === 0}
          onClick={() => submit("DITOLAK")}
        >
          Catat ditolak
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
