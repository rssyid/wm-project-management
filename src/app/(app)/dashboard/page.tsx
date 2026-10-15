import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <EmptyState message="Dashboard diisi setelah data jadwal dan progres tersedia pada fase F5." />
    </>
  );
}
