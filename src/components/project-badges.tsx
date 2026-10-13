import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { formatDecimal } from "@/shared/format";
import {
  EWS_LEVEL_LABEL,
  PROJECT_STATUS_LABEL,
  type EwsLevel,
  type ProjectStatus,
} from "@/shared/project-status";

const PROJECT_STATUS_TONE: Record<ProjectStatus, StatusTone> = {
  DRAFT: "neutral",
  SURVEY: "info",
  RAB_READY: "info",
  WAITING_AFCE_AR: "info",
  AFCE_AR_APPROVED: "success",
  PROCUREMENT: "info",
  EXECUTION: "info",
  WAITING_BAST: "info",
  COMPLETED: "success",
  ON_HOLD: "warning",
  CANCELLED: "neutral",
};

const EWS_TONE: Record<EwsLevel, StatusTone> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "danger",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <StatusBadge kind="project" label={PROJECT_STATUS_LABEL[status]} tone={PROJECT_STATUS_TONE[status]} />
  );
}

/** docs/05 §9: "EWS: Merah (12,3)". Deviation arrives as a Decimal string from progress-ews. */
export function EwsBadge({ level, deviation }: { level: EwsLevel; deviation: string }) {
  return (
    <StatusBadge
      kind="ews"
      label={`${EWS_LEVEL_LABEL[level]} (${formatDecimal(deviation)})`}
      tone={EWS_TONE[level]}
    />
  );
}
