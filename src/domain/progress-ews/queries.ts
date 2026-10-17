// docs/01 §10–11: membaca data progres dan EWS dari database untuk API dan Gantt (F5).
import {
  decimal,
  sumDecimal,
  type DecimalValue,
} from "@/infra/decimal";
import { todayBusinessDateIso } from "@/shared/date";

type DeliveryItemWithItem = {
  qty: DecimalValue;
  workPackageItem: {
    plannedQty: DecimalValue;
  };
  deliveryItems?: readonly { qty: DecimalValue }[];
};

type PackageWithItems = {
  weightPct: DecimalValue;
  items: readonly DeliveryItemWithItem[];
};

type ProcessLogs = {
  cumulativePct: DecimalValue;
  weekStart: Date;
  supersededById: string | null;
}[];

type WorkItemWithRelations = {
  id: string;
  name: string;
  type: string;
  projectWeightPct: DecimalValue;
  physicalWeightPct: DecimalValue;
  materialWeightPct: DecimalValue;
  physicalProcess: {
    status: string;
    progressLogs: ProcessLogs;
  } | null;
  workPackages: readonly PackageWithItems[];
};

/** Log progres aktif (belum digantikan) untuk minggu tertentu. */
export function activeLog(
  logs: ProcessLogs,
  weekStartIso: string,
): (ProcessLogs[number]) | undefined {
  return logs.find(
    (log) =>
      log.supersededById === null &&
      new Date(log.weekStart).toISOString().slice(0, 10) === weekStartIso,
  );
}

/** Terima kumulatif terbaru dari semua log (mengabaikan yang digantikan). */
export function latestCumulativePct(logs: ProcessLogs): DecimalValue {
  const activeLogs = logs.filter((log) => log.supersededById === null);
  if (activeLogs.length === 0) return decimal("0");
  const latest = activeLogs.reduce((a, b) =>
    new Date(a.weekStart) >= new Date(b.weekStart) ? a : b,
  );
  return latest.cumulativePct;
}

/** Progres paket dari item dan kiriman (AC-49 paket). */
export function packageProgressFromDb(
  pkg: PackageWithItems,
): DecimalValue {
  const items = pkg.items;
  if (items.length === 0) return decimal("0");
  const total = sumDecimal(
    items.map((item) => {
      const planned = item.workPackageItem.plannedQty;
      const delivered = sumDecimal(
        (item.deliveryItems ?? []).map((d) => d.qty),
      );
      const ratio = delivered.div(planned);
      return ratio.lessThanOrEqualTo(decimal("1")) ? ratio : decimal("1");
    }),
  );
  return total.div(decimal(items.length)).times(decimal("100"));
}

/** Status proses fisik untuk Pekerjaan (BELUM_MULAI, BERJALAN, JEDA_SPK_BATAL, SELESAI). */
export function physicalStatusOf(wi: WorkItemWithRelations): string | null {
  return wi.physicalProcess?.status ?? null;
}

/** Hari ini di Asia/Jakarta sebagai string YYYY-MM-DD. */
export function todayIso(): string {
  return todayBusinessDateIso();
}
