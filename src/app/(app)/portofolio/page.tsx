import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PortfolioPage() {
  return (
    <>
      <PageHeader
        title="Portofolio"
        description="Gantt matriks mingguan untuk proyek terfilter."
      />
      <EmptyState message="Gantt portofolio dibangun pada fase F5, setelah service jadwal dan progres tersedia." />
    </>
  );
}
