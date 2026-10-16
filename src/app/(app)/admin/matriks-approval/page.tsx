import { ApprovalTierEditor } from "@/components/admin/approval-tier-editor";
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
      <ApprovalTierEditor tiers={tiers} positions={positions} />
    </>
  );
}
