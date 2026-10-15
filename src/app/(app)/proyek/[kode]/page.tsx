import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ProjectStatusBadge } from "@/components/project-badges";
import { AfceTab } from "@/components/project/afce-tab";
import { ArSupplementPanel } from "@/components/project/ar-supplement-panel";
import { NextSteps, type NextAction } from "@/components/project/next-steps";
import { SurveyTab } from "@/components/project/survey-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listArSupplements } from "@/domain/afce/ar";
import { listAttempts } from "@/domain/afce/queries";
import { listOwnerFiles } from "@/domain/files/links";
import { getProjectByCode } from "@/domain/project/queries";
import { prisma } from "@/infra/db";
import { getSessionUser } from "@/infra/session";
import { formatRupiah } from "@/shared/format";
import { can } from "@/shared/permissions";
import {
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/shared/project-status";

type Params = Promise<{ kode: string }>;

type StepPlan = {
  prerequisites: { label: string; done: boolean }[];
  actions: NextAction[];
};

/** Prasyarat dan aksi utama per status; status F3 ke atas belum punya aksi di fase ini. */
function planFor(
  status: ProjectStatus,
  projectId: string,
  hasSurvey: boolean,
): StepPlan {
  switch (status) {
    case "DRAFT":
      return {
        prerequisites: [
          { label: "PIC sudah dipilih", done: false },
          { label: "Target mulai dan selesai sudah diisi", done: false },
          { label: "Anggaran rencana sudah diisi", done: false },
        ],
        actions: [
          {
            key: "start-survey",
            label: "Mulai survei",
            method: "POST",
            path: `/api/projects/${projectId}/start-survey`,
          },
        ],
      };
    case "SURVEY":
      return {
        prerequisites: hasSurvey
          ? []
          : [{ label: "Survei belum diisi", done: false }],
        actions: [],
      };
    case "RAB_READY":
      return {
        prerequisites: [],
        actions: [
          {
            key: "new-attempt",
            label: "Buat attempt AFCE",
            method: "POST",
            path: `/api/projects/${projectId}/afce-attempts`,
            body: {},
          },
        ],
      };
    default:
      return { prerequisites: [], actions: [] };
  }
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Params;
}) {
  const { kode } = await params;
  const project = await getProjectByCode(kode);
  if (!project) notFound();

  const user = await getSessionUser();
  const canWrite = can(user?.role ?? "MANAGEMENT_VIEWER", "project.write");
  const [attempts, supplements, positions, surveyFiles] = await Promise.all([
    listAttempts(project.id),
    listArSupplements(project.id),
    prisma.approvalPosition.findMany({
      orderBy: { rank: "asc" },
      select: { id: true, name: true },
    }),
    project.survey
      ? listOwnerFiles(prisma, "Survey", project.survey.id)
      : Promise.resolve([]),
  ]);

  const surveyLocked = attempts.some(
    (attempt) => attempt.submittedDate !== null,
  );
  const mainEstate =
    project.estates.find((estate) => estate.isPrimary) ?? project.estates[0];
  const officialEntries = project.budgetEntries;
  const plan = planFor(project.status, project.id, project.survey !== null);

  return (
    <>
      <PageHeader
        title={`${project.code} · ${project.name}`}
        description={`${project.company.name} · ${project.category.name}`}
        actions={<ProjectStatusBadge status={project.status} />}
      />

      <dl className="mb-6 grid gap-x-6 gap-y-3 border-y bg-panel px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Company</dt>
          <dd>{project.company.name}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Estate utama</dt>
          <dd>
            {mainEstate
              ? `${mainEstate.estate.code} · ${mainEstate.estate.name}`
              : "—"}
            {project.estates.length > 1
              ? ` +${project.estates.length - 1}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Wilayah</dt>
          <dd>
            {mainEstate
              ? `${mainEstate.estate.wilayah.name} (${mainEstate.estate.wilayah.region.code})`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">PIC</dt>
          <dd>{project.pic?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Target selesai</dt>
          <dd>{project.targetEndDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Anggaran rencana</dt>
          <dd>
            {project.plannedBudget ? formatRupiah(project.plannedBudget) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Anggaran resmi</dt>
          <dd>
            {officialEntries.length > 0
              ? formatRupiah(
                  String(
                    officialEntries.reduce(
                      (total, entry) => total + Number(entry.amount ?? 0),
                      0,
                    ),
                  ),
                )
              : "belum ada"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Status</dt>
          <dd>{PROJECT_STATUS_LABEL[project.status]}</dd>
        </div>
      </dl>

      {project.status === "ON_HOLD" ? (
        <p className="mb-4 rounded border bg-ews-yellow-soft px-3 py-2 text-sm text-ews-yellow">
          Proyek ditahan: {project.onHoldReason ?? "tanpa alasan tercatat"}.
        </p>
      ) : null}

      {canWrite ? (
        <NextSteps
          status={project.status}
          prerequisites={plan.prerequisites}
          actions={plan.actions}
        />
      ) : null}

      <Tabs defaultValue="ringkasan">
        <div
          role="group"
          aria-label="Bagian proyek"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <TabsList>
            <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
            <TabsTrigger value="survei">Survei</TabsTrigger>
            <TabsTrigger value="afce">AFCE/AR</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">Deskripsi</dt>
              <dd>{project.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Target mulai</dt>
              <dd>{project.targetStartDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Kategori</dt>
              <dd>{project.category.name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">Lokasi</dt>
              <dd>
                {project.estates
                  .map(
                    (estate) =>
                      `${estate.estate.code} · ${estate.estate.name}${
                        estate.isPrimary ? " (utama)" : ""
                      }${estate.block ? ` · ${estate.block.blockCode}` : ""}`,
                  )
                  .join("; ") || "—"}
              </dd>
            </div>
          </dl>
        </TabsContent>

        <TabsContent value="survei">
          <SurveyTab
            projectId={project.id}
            survey={
              project.survey
                ? {
                    id: project.survey.id,
                    surveyDate: project.survey.surveyDate ?? "",
                    surveyorNames: project.survey.surveyorNames,
                    existingCondition: project.survey.existingCondition,
                    recommendation: project.survey.recommendation,
                    latitude: project.survey.latitude,
                    longitude: project.survey.longitude,
                    notes: project.survey.notes,
                    version: project.survey.version,
                    files: {
                      photos: surveyFiles.filter(
                        (file) => file.kind === "PROGRESS_PHOTO",
                      ),
                      documents: surveyFiles.filter(
                        (file) => file.kind === "DOCUMENT",
                      ),
                      spatial: surveyFiles.filter(
                        (file) => file.kind === "SPATIAL_DATA",
                      ),
                    },
                  }
                : null
            }
            locked={surveyLocked || !canWrite}
          />
        </TabsContent>

        <TabsContent value="afce">
          <div className="flex flex-col gap-6">
            <AfceTab
              projectId={project.id}
              attempts={attempts}
              positions={positions}
              canWrite={canWrite}
            />
            <ArSupplementPanel
              projectId={project.id}
              supplements={supplements}
              canWrite={canWrite}
            />
            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">Anggaran</h3>
              {officialEntries.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Anggaran resmi terbentuk setelah AFCE terakhir disetujui.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {officialEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex justify-between border-b py-1"
                    >
                      <span>
                        {entry.type === "INITIAL"
                          ? "AFCE disetujui"
                          : "AR tambahan"}{" "}
                        · {entry.effectiveDate ?? "—"}
                      </span>
                      <span className="tabular-nums">
                        {formatRupiah(entry.amount ?? "0")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
