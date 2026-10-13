import { cn } from "cn";

// docs/05 §9: every badge is prefixed with its kind so project and process statuses never merge.
const KIND_PREFIX = {
  project: "Proyek",
  tender: "Tender",
  spk: "SPK",
  physical: "Fisik",
  package: "Paket",
  payment: "Bayar",
  afce: "AFCE",
  bast: "BAST",
  ews: "EWS",
} as const;

export type StatusKind = keyof typeof KIND_PREFIX;

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-surface text-ink border-line",
  info: "bg-canal-soft text-canal border-transparent",
  success: "bg-ews-green-soft text-ews-green border-transparent",
  warning: "bg-ews-yellow-soft text-ews-yellow border-transparent",
  danger: "bg-ews-red-soft text-ews-red border-transparent",
};

type StatusBadgeProps = {
  kind: StatusKind;
  /** Attempt number for "Tender #2" / "AFCE #1". */
  sequence?: number;
  label: string;
  tone: StatusTone;
};

export function StatusBadge({ kind, sequence, label, tone }: StatusBadgeProps) {
  const prefix =
    sequence === undefined
      ? KIND_PREFIX[kind]
      : `${KIND_PREFIX[kind]} #${sequence}`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
      )}
    >
      {prefix}: {label}
    </span>
  );
}
