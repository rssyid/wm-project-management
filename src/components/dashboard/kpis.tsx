"use client";

import { formatPercent } from "@/shared/format";

type KpiRowProps = {
  label: string;
  value: string;
};

export function KpiRow({ label, value }: KpiRowProps) {
  return (
    <div className="rounded-sm border border-line bg-panel p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="text-2xl font-semibold text-ink tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function DashboardKpis({
  projectCount,
  averageProgress,
  byStatus,
}: {
  projectCount: number;
  averageProgress: string;
  byStatus: Record<string, number>;
}) {
  const statusOrder = [
    "DRAFT",
    "SURVEY",
    "RAB_READY",
    "WAITING_AFCE_AR",
    "AFCE_AR_APPROVED",
    "PROCUREMENT",
    "EXECUTION",
    "WAITING_BAST",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ];

  return (
    <section className="mb-6 border-y bg-panel px-4 py-3">
      <h2 className="mb-3 text-base font-semibold">Ringkasan Portofolio</h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiRow label="Jumlah Proyek" value={String(projectCount)} />
        <KpiRow
          label="Progres Rata-rata"
          value={formatPercent(averageProgress)}
        />
        {statusOrder.map((status) => (
          <KpiRow
            key={status}
            label={status}
            value={String(byStatus[status] ?? 0)}
          />
        ))}
      </div>
    </section>
  );
}
