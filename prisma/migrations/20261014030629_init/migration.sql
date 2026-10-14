-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'WM_HO_SPECIALIST', 'MANAGEMENT_VIEWER');

-- CreateEnum
CREATE TYPE "Ops" AS ENUM ('SUMATERA', 'KALBAR', 'WILTIM');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SURVEY', 'RAB_READY', 'WAITING_AFCE_AR', 'AFCE_AR_APPROVED', 'PROCUREMENT', 'EXECUTION', 'WAITING_BAST', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDocStatus" AS ENUM ('DRAFT', 'DIAJUKAN', 'APPROVED', 'DITOLAK');

-- CreateEnum
CREATE TYPE "ApprovalResult" AS ENUM ('APPROVED', 'DITOLAK');

-- CreateEnum
CREATE TYPE "BudgetEntryType" AS ENUM ('INITIAL', 'AR_SUPPLEMENT');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('TENDER_CONTRACT', 'SWAKELOLA', 'PURCHASE');

-- CreateEnum
CREATE TYPE "TenderAttemptStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SpkStatus" AS ENUM ('DRAFT', 'RELEASED', 'BATAL');

-- CreateEnum
CREATE TYPE "PhysicalStatus" AS ENUM ('BELUM_MULAI', 'BERJALAN', 'JEDA_SPK_BATAL', 'SELESAI');

-- CreateEnum
CREATE TYPE "WorkPackageStatus" AS ENUM ('DRAFT', 'PR_SUBMITTED', 'PO_ISSUED', 'PRODUKSI', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('BELUM_LUNAS', 'LUNAS');

-- CreateEnum
CREATE TYPE "BastStatus" AS ENUM ('DIAJUKAN', 'TERVERIFIKASI', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('EKSTERNAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ScheduleProcessType" AS ENUM ('TENDER_ATTEMPT', 'PHYSICAL', 'WORK_PACKAGE');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('PROGRESS_PHOTO', 'APPROVAL_EVIDENCE', 'BAST', 'DOCUMENT', 'SPATIAL_DATA');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MANAGEMENT_VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ops" "Ops" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wilayah" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wilayah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "wilayahId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estateNew" TEXT,
    "legacyCode" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "estateId" TEXT NOT NULL,
    "blockCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plantingYear" INTEGER,
    "areaHectares" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VendorType" NOT NULL DEFAULT 'EKSTERNAL',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "npwp" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "defaultUnitId" TEXT NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeavyEquipmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeavyEquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "workingWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "ewsYellowFrom" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "ewsRedAbove" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPosition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalMatrixTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "forAfce" BOOLEAN NOT NULL DEFAULT true,
    "forArSupplement" BOOLEAN NOT NULL DEFAULT true,
    "minAmount" DECIMAL(18,2) NOT NULL,
    "maxAmount" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalMatrixTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalMatrixTierLevel" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "levelNo" INTEGER NOT NULL,
    "positionId" TEXT NOT NULL,

    CONSTRAINT "ApprovalMatrixTierLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "picUserId" TEXT,
    "targetStartDate" DATE,
    "targetEndDate" DATE,
    "plannedBudget" DECIMAL(18,2),
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "previousStatus" "ProjectStatus",
    "onHoldReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEstate" (
    "projectId" TEXT NOT NULL,
    "estateId" TEXT NOT NULL,
    "blockId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectEstate_pkey" PRIMARY KEY ("projectId","estateId")
);

-- CreateTable
CREATE TABLE "ProjectCodeCounter" (
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectCodeCounter_pkey" PRIMARY KEY ("companyId","year")
);

-- CreateTable
CREATE TABLE "ProjectStatusHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" "ProjectStatus",
    "toStatus" "ProjectStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "BudgetEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "arSupplementId" TEXT,
    "effectiveDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "surveyDate" DATE NOT NULL,
    "surveyorNames" TEXT NOT NULL,
    "existingCondition" TEXT NOT NULL,
    "recommendation" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfceAttempt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" "ApprovalDocStatus" NOT NULL DEFAULT 'DRAFT',
    "rabReady" BOOLEAN NOT NULL DEFAULT false,
    "afceNumber" TEXT,
    "documentDate" DATE,
    "basisAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "matrixTierId" TEXT,
    "submittedDate" DATE,
    "approvalEmailDate" DATE,
    "decidedDate" DATE,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfceAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqItem" (
    "id" TEXT NOT NULL,
    "afceAttemptId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "buildingName" TEXT,
    "activityName" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArSupplement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ApprovalDocStatus" NOT NULL DEFAULT 'DRAFT',
    "matrixTierId" TEXT,
    "submittedDate" DATE,
    "approvalEmailDate" DATE,
    "decidedDate" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArSupplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLevelSnapshot" (
    "id" TEXT NOT NULL,
    "afceAttemptId" TEXT,
    "arSupplementId" TEXT,
    "levelNo" INTEGER NOT NULL,
    "positionId" TEXT NOT NULL,
    "positionNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "ApprovalLevelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "levelSnapshotId" TEXT NOT NULL,
    "result" "ApprovalResult" NOT NULL,
    "approverName" TEXT NOT NULL,
    "decisionDate" DATE NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "projectWeightPct" DECIMAL(5,2) NOT NULL,
    "physicalWeightPct" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "materialWeightPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "targetVolume" DECIMAL(18,3),
    "unitId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uspk" (
    "id" TEXT NOT NULL,
    "tenderAttemptId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Uspk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderAttempt" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" "TenderAttemptStatus" NOT NULL DEFAULT 'PLANNED',
    "actualStart" DATE,
    "actualEnd" DATE,
    "winnerVendorId" TEXT,
    "winnerNameSnapshot" TEXT,
    "cancelledDate" DATE,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spk" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "tenderAttemptId" TEXT,
    "vendorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(18,2),
    "status" "SpkStatus" NOT NULL DEFAULT 'DRAFT',
    "releasedDate" DATE,
    "cancelledDate" DATE,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalProcess" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "status" "PhysicalStatus" NOT NULL DEFAULT 'BELUM_MULAI',
    "actualStart" DATE,
    "actualEnd" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalPause" (
    "id" TEXT NOT NULL,
    "physicalProcessId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "triggerSpkId" TEXT NOT NULL,

    CONSTRAINT "PhysicalPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" TEXT NOT NULL,
    "physicalProcessId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "cumulativePct" DECIMAL(5,2) NOT NULL,
    "volume" DECIMAL(18,3),
    "notes" TEXT,
    "decreaseReason" TEXT,
    "supersededById" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeavyEquipmentUsage" (
    "id" TEXT NOT NULL,
    "progressLogId" TEXT NOT NULL,
    "heavyEquipmentTypeId" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL,
    "workingHours" DECIMAL(10,1) NOT NULL,
    "vendorId" TEXT,
    "notes" TEXT,

    CONSTRAINT "HeavyEquipmentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPackage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WorkPackageStatus" NOT NULL DEFAULT 'DRAFT',
    "weightPct" DECIMAL(5,2) NOT NULL,
    "vendorId" TEXT,
    "productionStartDate" DATE,
    "completedDate" DATE,
    "cancelledDate" DATE,
    "cancelReason" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'BELUM_LUNAS',
    "invoiceAmount" DECIMAL(18,2),
    "paidDate" DATE,
    "paymentNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vendorId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPackageItem" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "plannedQty" DECIMAL(18,3) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDelivery" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "doNumber" TEXT,
    "notes" TEXT,
    "isCorrection" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "workPackageItemId" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "PackageDeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBaseline" (
    "id" TEXT NOT NULL,
    "processType" "ScheduleProcessType" NOT NULL,
    "tenderAttemptId" TEXT,
    "physicalProcessId" TEXT,
    "sourceTenderAttemptId" TEXT,
    "workPackageId" TEXT,
    "plannedStart" DATE NOT NULL,
    "plannedEnd" DATE NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleRevision" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "plannedStart" DATE NOT NULL,
    "plannedEnd" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BastDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "BastStatus" NOT NULL DEFAULT 'DIAJUKAN',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BastDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "FileKind" NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "projectId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTombstone" (
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedById" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ProjectTombstone_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Wilayah_regionId_name_key" ON "Wilayah"("regionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Estate_wilayahId_idx" ON "Estate"("wilayahId");

-- CreateIndex
CREATE UNIQUE INDEX "Estate_companyId_code_key" ON "Estate"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Block_estateId_blockCode_key" ON "Block"("estateId", "blockCode");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCategory_code_key" ON "ProjectCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Material_name_idx" ON "Material"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HeavyEquipmentType_name_key" ON "HeavyEquipmentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPosition_code_key" ON "ApprovalPosition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPosition_rank_key" ON "ApprovalPosition"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalMatrixTierLevel_tierId_levelNo_key" ON "ApprovalMatrixTierLevel"("tierId", "levelNo");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalMatrixTierLevel_tierId_positionId_key" ON "ApprovalMatrixTierLevel"("tierId", "positionId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_categoryId_idx" ON "Project"("categoryId");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "ProjectEstate_estateId_idx" ON "ProjectEstate"("estateId");

-- CreateIndex
CREATE INDEX "ProjectStatusHistory_projectId_at_idx" ON "ProjectStatusHistory"("projectId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetEntry_arSupplementId_key" ON "BudgetEntry"("arSupplementId");

-- CreateIndex
CREATE INDEX "BudgetEntry_projectId_idx" ON "BudgetEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_projectId_key" ON "Survey"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AfceAttempt_projectId_attemptNo_key" ON "AfceAttempt"("projectId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "BoqItem_afceAttemptId_lineNo_key" ON "BoqItem"("afceAttemptId", "lineNo");

-- CreateIndex
CREATE INDEX "ArSupplement_projectId_idx" ON "ArSupplement"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalLevelSnapshot_afceAttemptId_levelNo_key" ON "ApprovalLevelSnapshot"("afceAttemptId", "levelNo");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalLevelSnapshot_arSupplementId_levelNo_key" ON "ApprovalLevelSnapshot"("arSupplementId", "levelNo");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_levelSnapshotId_key" ON "ApprovalRecord"("levelSnapshotId");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_idx" ON "WorkItem"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Uspk_tenderAttemptId_key" ON "Uspk"("tenderAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderAttempt_workItemId_attemptNo_key" ON "TenderAttempt"("workItemId", "attemptNo");

-- CreateIndex
CREATE INDEX "Spk_workItemId_status_idx" ON "Spk"("workItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalProcess_workItemId_key" ON "PhysicalProcess"("workItemId");

-- CreateIndex
CREATE INDEX "PhysicalPause_physicalProcessId_idx" ON "PhysicalPause"("physicalProcessId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressLog_supersededById_key" ON "ProgressLog"("supersededById");

-- CreateIndex
CREATE INDEX "ProgressLog_physicalProcessId_weekStart_idx" ON "ProgressLog"("physicalProcessId", "weekStart");

-- CreateIndex
CREATE INDEX "HeavyEquipmentUsage_progressLogId_idx" ON "HeavyEquipmentUsage"("progressLogId");

-- CreateIndex
CREATE INDEX "WorkPackage_projectId_idx" ON "WorkPackage"("projectId");

-- CreateIndex
CREATE INDEX "WorkPackage_workItemId_idx" ON "WorkPackage"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_workPackageId_key" ON "PurchaseRequest"("workPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_workPackageId_key" ON "PurchaseOrder"("workPackageId");

-- CreateIndex
CREATE INDEX "WorkPackageItem_workPackageId_idx" ON "WorkPackageItem"("workPackageId");

-- CreateIndex
CREATE INDEX "PackageDelivery_workPackageId_deliveryDate_idx" ON "PackageDelivery"("workPackageId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDeliveryItem_deliveryId_workPackageItemId_key" ON "PackageDeliveryItem"("deliveryId", "workPackageItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBaseline_tenderAttemptId_key" ON "ScheduleBaseline"("tenderAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBaseline_workPackageId_key" ON "ScheduleBaseline"("workPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBaseline_physicalProcessId_sourceTenderAttemptId_key" ON "ScheduleBaseline"("physicalProcessId", "sourceTenderAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleRevision_baselineId_revisionNo_key" ON "ScheduleRevision"("baselineId", "revisionNo");

-- CreateIndex
CREATE INDEX "BastDocument_projectId_idx" ON "BastDocument"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_key_key" ON "FileObject"("key");

-- CreateIndex
CREATE INDEX "FileObject_ownerType_ownerId_idx" ON "FileObject"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "FileObject_projectId_idx" ON "FileObject"("projectId");

-- CreateIndex
CREATE INDEX "FileObject_status_uploadedAt_idx" ON "FileObject"("status", "uploadedAt");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTombstone_code_key" ON "ProjectTombstone"("code");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wilayah" ADD CONSTRAINT "Wilayah_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estate" ADD CONSTRAINT "Estate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estate" ADD CONSTRAINT "Estate_wilayahId_fkey" FOREIGN KEY ("wilayahId") REFERENCES "Wilayah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalMatrixTierLevel" ADD CONSTRAINT "ApprovalMatrixTierLevel_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "ApprovalMatrixTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalMatrixTierLevel" ADD CONSTRAINT "ApprovalMatrixTierLevel_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ApprovalPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProjectCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstate" ADD CONSTRAINT "ProjectEstate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstate" ADD CONSTRAINT "ProjectEstate_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEstate" ADD CONSTRAINT "ProjectEstate_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCodeCounter" ADD CONSTRAINT "ProjectCodeCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEntry" ADD CONSTRAINT "BudgetEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEntry" ADD CONSTRAINT "BudgetEntry_arSupplementId_fkey" FOREIGN KEY ("arSupplementId") REFERENCES "ArSupplement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEntry" ADD CONSTRAINT "BudgetEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfceAttempt" ADD CONSTRAINT "AfceAttempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfceAttempt" ADD CONSTRAINT "AfceAttempt_matrixTierId_fkey" FOREIGN KEY ("matrixTierId") REFERENCES "ApprovalMatrixTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_afceAttemptId_fkey" FOREIGN KEY ("afceAttemptId") REFERENCES "AfceAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArSupplement" ADD CONSTRAINT "ArSupplement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArSupplement" ADD CONSTRAINT "ArSupplement_matrixTierId_fkey" FOREIGN KEY ("matrixTierId") REFERENCES "ApprovalMatrixTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLevelSnapshot" ADD CONSTRAINT "ApprovalLevelSnapshot_afceAttemptId_fkey" FOREIGN KEY ("afceAttemptId") REFERENCES "AfceAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLevelSnapshot" ADD CONSTRAINT "ApprovalLevelSnapshot_arSupplementId_fkey" FOREIGN KEY ("arSupplementId") REFERENCES "ArSupplement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLevelSnapshot" ADD CONSTRAINT "ApprovalLevelSnapshot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ApprovalPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_levelSnapshotId_fkey" FOREIGN KEY ("levelSnapshotId") REFERENCES "ApprovalLevelSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uspk" ADD CONSTRAINT "Uspk_tenderAttemptId_fkey" FOREIGN KEY ("tenderAttemptId") REFERENCES "TenderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uspk" ADD CONSTRAINT "Uspk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderAttempt" ADD CONSTRAINT "TenderAttempt_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderAttempt" ADD CONSTRAINT "TenderAttempt_winnerVendorId_fkey" FOREIGN KEY ("winnerVendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spk" ADD CONSTRAINT "Spk_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spk" ADD CONSTRAINT "Spk_tenderAttemptId_fkey" FOREIGN KEY ("tenderAttemptId") REFERENCES "TenderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spk" ADD CONSTRAINT "Spk_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalProcess" ADD CONSTRAINT "PhysicalProcess_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalPause" ADD CONSTRAINT "PhysicalPause_physicalProcessId_fkey" FOREIGN KEY ("physicalProcessId") REFERENCES "PhysicalProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalPause" ADD CONSTRAINT "PhysicalPause_triggerSpkId_fkey" FOREIGN KEY ("triggerSpkId") REFERENCES "Spk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_physicalProcessId_fkey" FOREIGN KEY ("physicalProcessId") REFERENCES "PhysicalProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ProgressLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeavyEquipmentUsage" ADD CONSTRAINT "HeavyEquipmentUsage_progressLogId_fkey" FOREIGN KEY ("progressLogId") REFERENCES "ProgressLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeavyEquipmentUsage" ADD CONSTRAINT "HeavyEquipmentUsage_heavyEquipmentTypeId_fkey" FOREIGN KEY ("heavyEquipmentTypeId") REFERENCES "HeavyEquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeavyEquipmentUsage" ADD CONSTRAINT "HeavyEquipmentUsage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackageItem" ADD CONSTRAINT "WorkPackageItem_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackageItem" ADD CONSTRAINT "WorkPackageItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackageItem" ADD CONSTRAINT "WorkPackageItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDelivery" ADD CONSTRAINT "PackageDelivery_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDelivery" ADD CONSTRAINT "PackageDelivery_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDeliveryItem" ADD CONSTRAINT "PackageDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "PackageDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDeliveryItem" ADD CONSTRAINT "PackageDeliveryItem_workPackageItemId_fkey" FOREIGN KEY ("workPackageItemId") REFERENCES "WorkPackageItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_tenderAttemptId_fkey" FOREIGN KEY ("tenderAttemptId") REFERENCES "TenderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_physicalProcessId_fkey" FOREIGN KEY ("physicalProcessId") REFERENCES "PhysicalProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_sourceTenderAttemptId_fkey" FOREIGN KEY ("sourceTenderAttemptId") REFERENCES "TenderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRevision" ADD CONSTRAINT "ScheduleRevision_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "ScheduleBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRevision" ADD CONSTRAINT "ScheduleRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BastDocument" ADD CONSTRAINT "BastDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BastDocument" ADD CONSTRAINT "BastDocument_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BastDocument" ADD CONSTRAINT "BastDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BastDocument" ADD CONSTRAINT "BastDocument_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTombstone" ADD CONSTRAINT "ProjectTombstone_purgedById_fkey" FOREIGN KEY ("purgedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
