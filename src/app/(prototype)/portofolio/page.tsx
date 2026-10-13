import { PageHeader } from "@/components/page-header";
import { GanttLegend, GanttMatrix } from "@/prototype/gantt";
import { SAMPLE_GANTT } from "@/prototype/sample-data";

export default function PortfolioPage() {
  return (
    <>
      <PageHeader
        title="Portofolio"
        description="Gantt matriks mingguan untuk proyek terfilter."
      />
      <GanttLegend />
      <GanttMatrix rows={SAMPLE_GANTT} caption="Gantt portofolio" />
    </>
  );
}
