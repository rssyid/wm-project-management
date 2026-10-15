"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BoqEditor } from "@/components/project/boq-editor";
import { DecisionButtons } from "@/components/project/decision-buttons";
import { LevelEditor } from "@/components/project/level-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/shared/format";

export type AttemptView = {
  id: string;
  attemptNo: number;
  status: "DRAFT" | "DIAJUKAN" | "APPROVED" | "DITOLAK";
  rabReady: boolean;
  afceNumber: string | null;
  basisAmount: string | null;
  submittedDate: string | null;
  approvalEmailDate: string | null;
  decidedDate: string | null;
  version: number;
  matrixTier: {
    id: string;
    name: string;
    minAmount: string | null;
    maxAmount: string | null;
  } | null;
  boqItems: {
    id: string;
    lineNo: number;
    buildingName: string | null;
    activityName: string;
    amount: string | null;
  }[];
  levels: {
    id: string;
    levelNo: number;
    positionId: string;
    positionNameSnapshot: string;
    differsFromMatrix: boolean;
    record: {
      id: string;
      result: "APPROVED" | "DITOLAK";
      approverName: string;
      decisionDate: string | null;
      notes: string | null;
    } | null;
  }[];
};

const STATUS_LABEL: Record<AttemptView["status"], string> = {
  DRAFT: "Draf",
  DIAJUKAN: "Diajukan",
  APPROVED: "Disetujui",
  DITOLAK: "Ditolak",
};

export function AfceTab({
  projectId,
  attempts,
  positions,
  canWrite,
}: {
  projectId: string;
  attempts: AttemptView[];
  positions: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const latest = attempts[0];

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
    <div className="flex flex-col gap-6">
      {canWrite &&
      latest?.status !== "DRAFT" &&
      latest?.status !== "DIAJUKAN" ? (
        <div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              call("POST", `/api/projects/${projectId}/afce-attempts`, {})
            }
          >
            Buat attempt AFCE baru
          </Button>
        </div>
      ) : null}

      {attempts.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Belum ada pengajuan AFCE untuk proyek ini.
        </p>
      ) : null}

      {attempts.map((attempt) => (
        <AttemptCard
          key={attempt.id}
          attempt={attempt}
          positions={positions}
          canWrite={canWrite}
          busy={busy}
          call={call}
        />
      ))}
    </div>
  );
}

function AttemptCard({
  attempt,
  positions,
  canWrite,
  busy,
  call,
}: {
  attempt: AttemptView;
  positions: { id: string; name: string }[];
  canWrite: boolean;
  busy: boolean;
  call: (method: string, path: string, body?: unknown) => Promise<boolean>;
}) {
  const [afceNumber, setAfceNumber] = useState(attempt.afceNumber ?? "");
  const [submittedDate, setSubmittedDate] = useState(
    attempt.submittedDate ?? "",
  );
  const [approvalEmailDate, setApprovalEmailDate] = useState(
    attempt.approvalEmailDate ?? "",
  );

  const editable = canWrite && attempt.status === "DRAFT";
  const submitted = attempt.status !== "DRAFT";

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-panel p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          AFCE #{attempt.attemptNo} · {STATUS_LABEL[attempt.status]}
        </h3>
        <span className="text-sm tabular-nums">
          Nilai AFCE {formatRupiah(attempt.basisAmount ?? "0")}
        </span>
      </header>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Tier matriks</dt>
          <dd>{attempt.matrixTier?.name ?? "belum ada"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Tanggal pengajuan</dt>
          <dd>{attempt.submittedDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Tanggal email approval</dt>
          <dd>{attempt.approvalEmailDate ?? "—"}</dd>
        </div>
      </dl>

      {editable ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nomor AFCE">
              <Input
                value={afceNumber}
                onChange={(event) => setAfceNumber(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  call("PATCH", `/api/afce-attempts/${attempt.id}`, {
                    version: attempt.version,
                    afceNumber: afceNumber || null,
                    rabReady: !attempt.rabReady,
                  })
                }
              >
                {attempt.rabReady ? "Tandai belum siap" : "Tandai RAB siap"}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">BOQ</p>
            <BoqEditor
              attemptId={attempt.id}
              version={attempt.version}
              items={attempt.boqItems}
            />
          </div>

          <LevelEditor
            attemptId={attempt.id}
            version={attempt.version}
            positionIds={attempt.levels.map((level) => level.positionId)}
            positions={positions}
            differsFromMatrix={attempt.levels.some(
              (level) => level.differsFromMatrix,
            )}
          />

          <div className="grid gap-3 sm:grid-cols-2">
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
                onChange={(event) => setApprovalEmailDate(event.target.value)}
              />
            </Field>
          </div>
          <div>
            <Button
              disabled={busy}
              onClick={() =>
                call("POST", `/api/afce-attempts/${attempt.id}/submit`, {
                  version: attempt.version,
                  submittedDate,
                  approvalEmailDate,
                })
              }
            >
              Ajukan AFCE
            </Button>
          </div>
        </div>
      ) : null}

      {submitted ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Level approval</p>
          <ol className="flex flex-col gap-2 text-sm">
            {attempt.levels.map((level) => (
              <li
                key={level.id}
                className="flex flex-wrap items-center gap-2 border-b pb-2"
              >
                <span className="w-5 text-ink-muted tabular-nums">
                  {level.levelNo}
                </span>
                <span>{level.positionNameSnapshot}</span>
                {level.record ? (
                  <span className="text-ink-muted">
                    {level.record.result === "APPROVED"
                      ? "Disetujui"
                      : "Ditolak"}{" "}
                    oleh {level.record.approverName} pada{" "}
                    {level.record.decisionDate}
                  </span>
                ) : null}
                {canWrite && !level.record ? (
                  <DecisionButtons
                    levelId={level.id}
                    positionName={level.positionNameSnapshot}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
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
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
