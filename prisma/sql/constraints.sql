-- =============================================================================
-- WM Project Management — constraint tambahan yang tidak bisa ditulis di schema.prisma
-- Cara pakai (fase F1): setelah migration awal dibuat dari schema.prisma,
--   pnpm prisma migrate dev --create-only --name constraints
-- lalu salin isi file ini ke migration.sql yang baru dibuat, dan jalankan
--   pnpm prisma migrate dev
-- Nama tabel mengikuti nama model Prisma (diberi tanda kutip), kecuali tabel Better Auth.
-- =============================================================================

-- ----------------------------------------------------------------------------- CHECK: bobot dan angka

ALTER TABLE "WorkItem"
  ADD CONSTRAINT workitem_weight_range CHECK (
    "projectWeightPct" BETWEEN 0 AND 100
    AND "physicalWeightPct" BETWEEN 0 AND 100
    AND "materialWeightPct" BETWEEN 0 AND 100),
  ADD CONSTRAINT workitem_weight_sum CHECK ("physicalWeightPct" + "materialWeightPct" = 100),
  ADD CONSTRAINT workitem_purchase_weights CHECK (
    "type" <> 'PURCHASE' OR ("physicalWeightPct" = 0 AND "materialWeightPct" = 100));

ALTER TABLE "WorkPackage"
  ADD CONSTRAINT workpackage_weight_range CHECK ("weightPct" BETWEEN 0 AND 100);

ALTER TABLE "WorkPackageItem"
  ADD CONSTRAINT workpackageitem_qty_positive CHECK ("plannedQty" > 0);

ALTER TABLE "PackageDeliveryItem"
  ADD CONSTRAINT deliveryitem_qty_nonzero CHECK ("qty" <> 0);

ALTER TABLE "PackageDelivery"
  ADD CONSTRAINT delivery_correction_reason CHECK (
    "isCorrection" = false OR ("correctionReason" IS NOT NULL AND length(trim("correctionReason")) > 0));

ALTER TABLE "ProgressLog"
  ADD CONSTRAINT progresslog_pct_range CHECK ("cumulativePct" BETWEEN 0 AND 100);

ALTER TABLE "HeavyEquipmentUsage"
  ADD CONSTRAINT equipment_values CHECK ("unitCount" > 0 AND "workingHours" >= 0);

ALTER TABLE "BoqItem"
  ADD CONSTRAINT boq_amount_nonnegative CHECK ("amount" >= 0);

ALTER TABLE "ArSupplement"
  ADD CONSTRAINT ar_amount_positive CHECK ("amount" > 0);

ALTER TABLE "SystemSetting"
  ADD CONSTRAINT systemsetting_single_row CHECK ("id" = 1),
  ADD CONSTRAINT systemsetting_ews_order CHECK ("ewsYellowFrom" >= 0 AND "ewsRedAbove" >= "ewsYellowFrom");

-- ----------------------------------------------------------------------------- CHECK: tanggal

ALTER TABLE "ScheduleBaseline"
  ADD CONSTRAINT baseline_dates CHECK ("plannedEnd" >= "plannedStart");

ALTER TABLE "ScheduleRevision"
  ADD CONSTRAINT revision_dates CHECK ("plannedEnd" >= "plannedStart"),
  ADD CONSTRAINT revision_reason CHECK (length(trim("reason")) > 0);

ALTER TABLE "Project"
  ADD CONSTRAINT project_target_dates CHECK (
    "targetStartDate" IS NULL OR "targetEndDate" IS NULL OR "targetEndDate" >= "targetStartDate"),
  ADD CONSTRAINT project_previous_status CHECK (
    ("status" = 'ON_HOLD') = ("previousStatus" IS NOT NULL));

-- ----------------------------------------------------------------------------- CHECK: pemilik polimorfik

ALTER TABLE "ApprovalLevelSnapshot"
  ADD CONSTRAINT snapshot_single_owner CHECK (num_nonnulls("afceAttemptId", "arSupplementId") = 1),
  ADD CONSTRAINT snapshot_level_range CHECK ("levelNo" BETWEEN 1 AND 9);

ALTER TABLE "ApprovalMatrixTierLevel"
  ADD CONSTRAINT tierlevel_level_range CHECK ("levelNo" BETWEEN 1 AND 9);

ALTER TABLE "ApprovalMatrixTier"
  ADD CONSTRAINT tier_amount_order CHECK ("minAmount" >= 0 AND ("maxAmount" IS NULL OR "maxAmount" > "minAmount")),
  ADD CONSTRAINT tier_applies CHECK ("forAfce" OR "forArSupplement");

ALTER TABLE "ScheduleBaseline"
  ADD CONSTRAINT baseline_owner CHECK (
    ("processType" = 'TENDER_ATTEMPT' AND "tenderAttemptId" IS NOT NULL
       AND "physicalProcessId" IS NULL AND "workPackageId" IS NULL AND "sourceTenderAttemptId" IS NULL)
    OR ("processType" = 'PHYSICAL' AND "physicalProcessId" IS NOT NULL
       AND "tenderAttemptId" IS NULL AND "workPackageId" IS NULL)
    OR ("processType" = 'WORK_PACKAGE' AND "workPackageId" IS NOT NULL
       AND "tenderAttemptId" IS NULL AND "physicalProcessId" IS NULL AND "sourceTenderAttemptId" IS NULL));

ALTER TABLE "BudgetEntry"
  ADD CONSTRAINT budget_entry_type_link CHECK (
    ("type" = 'INITIAL' AND "arSupplementId" IS NULL)
    OR ("type" = 'AR_SUPPLEMENT' AND "arSupplementId" IS NOT NULL));

-- ----------------------------------------------------------------------------- PARTIAL UNIQUE INDEX

-- Satu tender attempt aktif per Pekerjaan (U-10)
CREATE UNIQUE INDEX tenderattempt_one_active
  ON "TenderAttempt" ("workItemId") WHERE "status" IN ('PLANNED', 'IN_PROGRESS');

-- Satu AFCE attempt DRAFT/DIAJUKAN per proyek
CREATE UNIQUE INDEX afceattempt_one_active
  ON "AfceAttempt" ("projectId") WHERE "status" IN ('DRAFT', 'DIAJUKAN');

-- Satu BAST DIAJUKAN per proyek (U-23)
CREATE UNIQUE INDEX bast_one_submitted
  ON "BastDocument" ("projectId") WHERE "status" = 'DIAJUKAN';

-- Satu log progres aktif per proses fisik per minggu (D-06)
CREATE UNIQUE INDEX progresslog_one_active_per_week
  ON "ProgressLog" ("physicalProcessId", "weekStart") WHERE "supersededById" IS NULL;

-- Satu baseline fisik swakelola per proses (sourceTenderAttemptId kosong)
CREATE UNIQUE INDEX baseline_physical_swakelola
  ON "ScheduleBaseline" ("physicalProcessId")
  WHERE "processType" = 'PHYSICAL' AND "sourceTenderAttemptId" IS NULL;

-- Tepat satu Estate utama per proyek (keberadaan minimal satu dijaga service)
CREATE UNIQUE INDEX projectestate_one_primary
  ON "ProjectEstate" ("projectId") WHERE "isPrimary";

-- Tepat satu anggaran INITIAL per proyek
CREATE UNIQUE INDEX budgetentry_one_initial
  ON "BudgetEntry" ("projectId") WHERE "type" = 'INITIAL';

-- ----------------------------------------------------------------------------- TRIGGER: tabel riwayat immutable (D-07)
-- Purge mengaktifkan pengecualian dengan: SET LOCAL app.allow_purge = 'on'; di dalam transaksi purge.

CREATE OR REPLACE FUNCTION wm_purge_allowed() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.allow_purge', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION wm_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF wm_purge_allowed() AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Tabel % bersifat immutable (operasi % ditolak)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

-- Tabel yang sepenuhnya immutable
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ProjectStatusHistory', 'BudgetEntry', 'ApprovalRecord', 'ScheduleRevision',
    'PackageDelivery', 'PackageDeliveryItem'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION wm_reject_mutation()',
      lower(t) || '_immutable', t);
  END LOOP;
END $$;

-- AuditLog dan ProjectTombstone tidak pernah dihapus, termasuk saat purge
CREATE OR REPLACE FUNCTION wm_reject_always() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % tidak boleh diubah atau dihapus', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER auditlog_immutable BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION wm_reject_always();
CREATE TRIGGER tombstone_immutable BEFORE UPDATE OR DELETE ON "ProjectTombstone"
  FOR EACH ROW EXECUTE FUNCTION wm_reject_always();

-- ProgressLog: hanya supersededById boleh diisi sekali (NULL -> nilai)
CREATE OR REPLACE FUNCTION wm_progresslog_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF wm_purge_allowed() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'ProgressLog tidak boleh dihapus' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."supersededById" IS NULL AND NEW."supersededById" IS NOT NULL
     AND (to_jsonb(NEW) - 'supersededById') = (to_jsonb(OLD) - 'supersededById') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'ProgressLog immutable; gunakan log pengganti' USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER progresslog_guard BEFORE UPDATE OR DELETE ON "ProgressLog"
  FOR EACH ROW EXECUTE FUNCTION wm_progresslog_guard();

-- PhysicalPause: hanya endDate boleh diisi sekali (NULL -> tanggal)
CREATE OR REPLACE FUNCTION wm_pause_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF wm_purge_allowed() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'PhysicalPause tidak boleh dihapus' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."endDate" IS NULL AND NEW."endDate" IS NOT NULL
     AND (to_jsonb(NEW) - 'endDate') = (to_jsonb(OLD) - 'endDate') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PhysicalPause hanya boleh ditutup sekali' USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER physicalpause_guard BEFORE UPDATE OR DELETE ON "PhysicalPause"
  FOR EACH ROW EXECUTE FUNCTION wm_pause_guard();

-- ScheduleBaseline: tidak boleh diubah setelah dikunci (kecuali purge)
CREATE OR REPLACE FUNCTION wm_baseline_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF wm_purge_allowed() OR OLD."lockedAt" IS NULL THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Baseline terkunci tidak boleh dihapus' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."lockedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Baseline terkunci; gunakan ScheduleRevision' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER schedulebaseline_guard BEFORE UPDATE OR DELETE ON "ScheduleBaseline"
  FOR EACH ROW EXECUTE FUNCTION wm_baseline_guard();
