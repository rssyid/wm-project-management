import { ApprovalTierEditor } from "@/components/admin/approval-tier-editor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { listTiers } from "@/domain/approval-matrix/service";
import { prisma } from "@/infra/db";

export default async function ApprovalMatrixPage() {
  const [tiers, positions] = await Promise.all([
    listTiers(),
    prisma.approvalPosition.findMany({
      orderBy: { rank: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Matriks approval"
        description="Tier dipilih Super Admin. Batas bawah inklusif, batas atas eksklusif, dan rentang aktif tidak boleh tumpang tindih atau berlubang."
      />
      {tiers.length === 0 ? (
        <EmptyState message="Belum ada tier matriks approval, sehingga AFCE belum bisa diajukan." />
      ) : (
        <ApprovalTierEditor tiers={tiers} positions={positions} />
      )}
    </>
  );
}
