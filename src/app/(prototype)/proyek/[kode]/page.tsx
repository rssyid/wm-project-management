import { notFound } from "next/navigation";

import { EwsBadge, ProjectStatusBadge } from "@/components/project-badges";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatPercent, formatRupiah } from "@/shared/format";
import { GanttLegend, GanttMatrix } from "@/prototype/gantt";
import { MutationOnly } from "@/prototype/role";
import { SAMPLE_GANTT, SAMPLE_PROJECTS, findSampleProject } from "@/prototype/sample-data";

const TABS = ["Ringkasan", "Survei", "AFCE/AR", "Pekerjaan", "Paket Kerja", "Jadwal", "BAST", "Riwayat"] as const;

export function generateStaticParams() {
  return SAMPLE_PROJECTS.map((project) => ({ kode: project.code }));
}

export default async function ProjectWorkspacePage({ params }: PageProps<"/proyek/[kode]">) {
  const { kode } = await params;
  const project = findSampleProject(decodeURIComponent(kode));
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title={`${project.code} · ${project.name}`}
        description={`${project.category} · ${project.companyCode} · ${project.mainEstate} · ${project.wilayah}, ${project.region}`}
        actions={
          <MutationOnly>
            <Button>Mulai tender</Button>
            <Button variant="outline">Lainnya</Button>
          </MutationOnly>
        }
      />

      <dl className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <dt className="sr-only">Status proyek</dt>
          <dd><ProjectStatusBadge status={project.status} /></dd>
        </div>
        <div>
          <dt className="sr-only">EWS</dt>
          <dd><EwsBadge level={project.ews.level} deviation={project.ews.deviation} /></dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">Progres</dt>
          <dd className="tabular-nums">{formatPercent(project.progress)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">{project.budgetOfficial ? "Anggaran resmi" : "Anggaran rencana"}</dt>
          <dd className="tabular-nums">{formatRupiah(project.budget)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">Target selesai</dt>
          <dd className="tabular-nums">{formatDate(new Date(project.targetEnd))}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">PIC</dt>
          <dd>{project.pic}</dd>
        </div>
      </dl>

      <section aria-labelledby="next-step" className="mb-6 rounded-lg border bg-panel p-4">
        <h2 id="next-step" className="text-base font-semibold">Langkah berikutnya</h2>
        <p className="mt-1 text-ink-muted">
          Mulai tender #2 pada Pekerjaan 1. Prasyarat: USPK tender #2 sudah terbit.
        </p>
      </section>

      <Tabs defaultValue="Jadwal">
        <div className="overflow-x-auto">
          <TabsList variant="line">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="pt-4">
            {tab === "Jadwal" ? (
              <>
                <GanttLegend />
                <GanttMatrix rows={SAMPLE_GANTT} caption={`Gantt ${project.code}`} />
              </>
            ) : (
              <p className="text-ink-muted">Isi tab {tab} dibuat di fase F2–F6.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
