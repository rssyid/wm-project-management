"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DecisionButtons } from "@/components/project/decision-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/shared/format";
import { todayBusinessDateIso } from "@/shared/date";

export type ArSupplementView = {
  id: string;
  number: string | null;
  amount: string | null;
  reason: string;
  date: string;
  status: "DRAFT" | "DIAJUKAN" | "APPROVED" | "DITOLAK";
  version: number;
  levels: {
    id: string;
    levelNo: number;
    positionId: string;
    positionNameSnapshot: string;
    record: {
      id: string;
      result: "APPROVED" | "DITOLAK";
      approverName: string;
      decisionDate: string | null;
    } | null;
  }[];
};

const STATUS_LABEL: Record<ArSupplementView["status"], string> = {
  DRAFT: "Draf",
  DIAJUKAN: "Diajukan",
  APPROVED: "Disetujui",
  DITOLAK: "Ditolak",
};

/** AC-25: AR tambahan menambah anggaran resmi setelah disetujui, tanpa mengubah status proyek. */
export function ArSupplementPanel({
  projectId,
  supplements,
  canWrite,
}: {
  projectId: string;
  supplements: ArSupplementView[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("0.00");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayBusinessDateIso());
  const [submittedDate, setSubmittedDate] = useState(todayBusinessDateIso());
  const [approvalEmailDate, setApprovalEmailDate] = useState(
    todayBusinessDateIso(),
  );

  async function call(method: string, path: string, body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        toast.error(payload.error?.message ?? "Aksi gagal dijalankan.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">AR tambahan</h3>

      {supplements.length === 0 ? (
        <p className="text-sm text-ink-muted">Belum ada AR tambahan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {supplements.map((supplement) => (
            <li
              key={supplement.id}
              className="flex flex-col gap-2 rounded border bg-panel p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {supplement.number ?? "AR tanpa nomor"} ·{" "}
                  {STATUS_LABEL[supplement.status]}
                </span>
                <span className="tabular-nums">
                  {formatRupiah(supplement.amount ?? "0")}
                </span>
              </div>
              <p className="text-ink-muted">
                {supplement.reason} · {supplement.date}
              </p>

              {supplement.status === "DIAJUKAN"
                ? supplement.levels.map((level) =>
                    level.record ? (
                      <p key={level.id} className="text-ink-muted">
                        Level {level.levelNo} {level.positionNameSnapshot}:{" "}
                        {level.record.result === "APPROVED"
                          ? "disetujui"
                          : "ditolak"}{" "}
                        oleh {level.record.approverName} pada{" "}
                        {level.record.decisionDate}
                      </p>
                    ) : canWrite ? (
                      <DecisionButtons
                        key={level.id}
                        levelId={level.id}
                        positionName={level.positionNameSnapshot}
                      />
                    ) : null,
                  )
                : null}

              {canWrite && supplement.status === "DRAFT" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Tanggal pengajuan">
                    <Input
                      type="date"
                      value={submittedDate}
                      onChange={(event) => setSubmittedDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Tanggal email approval">
                    <Input
                      type="date"
                      value={approvalEmailDate}
                      onChange={(event) =>
                        setApprovalEmailDate(event.target.value)
                      }
                    />
                  </Field>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      call(
                        "POST",
                        `/api/ar-supplements/${supplement.id}/submit`,
                        {
                          version: supplement.version,
                          submittedDate,
                          approvalEmailDate,
                        },
                      )
                    }
                  >
                    Ajukan AR tambahan
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        open ? (
          <div className="flex flex-col gap-2 rounded border bg-panel p-3">
            <Field label="Nomor AR">
              <Input placeholder="AR/2026/001" readOnly />
            </Field>
            <Field label="Nominal">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field label="Alasan">
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded border bg-panel px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Tanggal">
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy || reason.trim().length < 3}
                onClick={async () => {
                  const ok = await call(
                    "POST",
                    `/api/projects/${projectId}/ar-supplements`,
                    { number: null, amount, reason, date },
                  );
                  if (ok) setOpen(false);
                }}
              >
                Simpan AR tambahan
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Buat AR tambahan
            </Button>
          </div>
        )
      ) : null}
    </section>
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
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
