"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CancelDialog } from "@/components/project/cancel-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPercent } from "@/shared/format";

type WorkItemView = {
  id: string;
  name: string;
  type: string;
  projectWeightPct: string;
  physicalWeightPct: string;
  materialWeightPct: string;
  order: number;
  version: number;
  physicalProcess: {
    id: string;
    status: string;
    actualStart: Date | null;
    actualEnd: Date | null;
  } | null;
  tenderAttempts: Array<{
    id: string;
    attemptNo: number;
    status: string;
    winnerVendorId: string | null;
    winnerNameSnapshot: string | null;
    cancelledDate: Date | null;
  }>;
  spks: Array<{
    id: string;
    number: string;
    date: Date;
    value: string | null;
    status: string;
    releasedDate: Date | null;
    cancelledDate: Date | null;
    vendorId: string | null;
    tenderAttemptId: string | null;
  }>;
  workPackages: Array<{
    id: string;
    name: string;
    weightPct: string;
    status: string;
    vendorId: string | null;
    cancelledDate: Date | null;
    cancelReason: string | null;
    completedDate: Date | null;
    productionStartDate: Date | null;
    version: number;
  }>;
};

interface WorkItemTabProps {
  projectId: string;
  workItems: WorkItemView[];
  canWrite: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  TENDER_CONTRACT: "Tender Kontrak",
  SWAKELOLA: "Swakelola",
  PURCHASE: "Pembelian",
};

function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function WorkItemTab({
  projectId,
  workItems,
  canWrite,
}: WorkItemTabProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState("");
  const [cancelVersion, setCancelVersion] = useState(0);

  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState("TENDER_CONTRACT");
  const [addProjectWeight, setAddProjectWeight] = useState("");
  const [addPhysicalWeight, setAddPhysicalWeight] = useState("");
  const [addMaterialWeight, setAddMaterialWeight] = useState("");

  const [weightItemId, setWeightItemId] = useState("");
  const [weightVersion, setWeightVersion] = useState(0);
  const [weightPhysical, setWeightPhysical] = useState("");
  const [weightMaterial, setWeightMaterial] = useState("");

  async function call(method: string, path: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      toast.error(payload.error?.message ?? "Aksi gagal dijalankan.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function addWorkItem() {
    const existingTotal = workItems.reduce(
      (sum, w) => sum + toCents(w.projectWeightPct),
      0,
    );
    const total = existingTotal + toCents(addProjectWeight || "0");
    if (total !== 10000) {
      toast.error("Total bobot Pekerjaan harus tepat 100,00%.");
      return;
    }
    const physical = toCents(addPhysicalWeight || "0");
    const material = toCents(addMaterialWeight || "0");
    if (physical + material !== 10000) {
      toast.error("Bobot fisik dan material harus berjumlah 100,00%.");
      return;
    }
    const ok = await call("POST", `/api/projects/${projectId}/work-items`, {
      name: addName,
      type: addType,
      projectWeightPct: addProjectWeight,
      physicalWeightPct: addPhysicalWeight,
      materialWeightPct: addMaterialWeight,
    });
    if (ok) {
      setAddOpen(false);
      setAddName("");
      setAddProjectWeight("");
      setAddPhysicalWeight("");
      setAddMaterialWeight("");
      toast.success("Pekerjaan dibuat");
    }
  }

  async function saveWeight() {
    const physical = toCents(weightPhysical);
    const material = toCents(weightMaterial);
    if (physical + material !== 10000) {
      toast.error("Bobot fisik dan material harus berjumlah 100,00%.");
      return;
    }
    const ok = await call("PUT", `/api/work-items/${weightItemId}`, {
      version: weightVersion,
      physicalWeightPct: weightPhysical,
      materialWeightPct: weightMaterial,
    });
    if (ok) {
      setWeightOpen(false);
      toast.success("Bobot Pekerjaan diperbarui");
    }
  }

  async function distributeWeights() {
    const active = workItems.filter((w) => w.type !== "PURCHASE");
    if (active.length === 0) {
      toast.error("Tidak ada Pekerjaan aktif untuk dibagi bobot.");
      return;
    }
    const shareCents = Math.round(10000 / active.length);
    const share = (shareCents / 100).toFixed(2);
    const weights = active.map((w) => ({
      workItemId: w.id,
      projectWeightPct: share,
    }));
    const ok = await call(
      "PUT",
      `/api/projects/${projectId}/work-item-weights`,
      {
        version: workItems[0]?.version ?? 1,
        weights,
      },
    );
    if (ok) {
      toast.success("Bobot Pekerjaan dibagi rata");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Pekerjaan</h3>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAddOpen(true)}>Tambah Pekerjaan</Button>
            <Button variant="outline" onClick={distributeWeights}>
              Bagi rata bobot
            </Button>
          </div>
        ) : null}

        {workItems.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Belum ada Pekerjaan untuk proyek ini.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Jenis</TableHead>
                <TableHead className="text-right">Bobot Proyek</TableHead>
                <TableHead className="text-right">Fisik</TableHead>
                <TableHead className="text-right">Material</TableHead>
                <TableHead>Status Fisik</TableHead>
                {canWrite ? (
                  <TableHead className="text-right">Aksi</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="w-8 text-center">
                    {item.order}
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-center text-sm">
                    {TYPE_LABEL[item.type] ?? item.type}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPercent(item.projectWeightPct)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPercent(item.physicalWeightPct)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPercent(item.materialWeightPct)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.physicalProcess ? item.physicalProcess.status : "—"}
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="text-right">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWeightItemId(item.id);
                            setWeightVersion(item.version);
                            setWeightPhysical(item.physicalWeightPct);
                            setWeightMaterial(item.materialWeightPct);
                            setWeightOpen(true);
                          }}
                        >
                          Ubah bobot
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setCancelId(item.id);
                            setCancelVersion(item.version);
                            setCancelOpen(true);
                          }}
                        >
                          Batalkan
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {addOpen && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Pekerjaan</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label>Nama Pekerjaan</Label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Jenis</Label>
                <Input
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Bobot Proyek (%)</Label>
                <Input
                  value={addProjectWeight}
                  onChange={(e) => setAddProjectWeight(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Bobot Fisik (%)</Label>
                <Input
                  value={addPhysicalWeight}
                  onChange={(e) => setAddPhysicalWeight(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Bobot Material (%)</Label>
                <Input
                  value={addMaterialWeight}
                  onChange={(e) => setAddMaterialWeight(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Batal
              </Button>
              <Button onClick={addWorkItem}>Tambah Pekerjaan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {weightOpen && (
        <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Bobot Fisik/Material</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label>Bobot Fisik (%)</Label>
                <Input
                  value={weightPhysical}
                  onChange={(e) => setWeightPhysical(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Bobot Material (%)</Label>
                <Input
                  value={weightMaterial}
                  onChange={(e) => setWeightMaterial(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-ink-muted">
                Total fisik + material harus 100,00%.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWeightOpen(false)}>
                Batal
              </Button>
              <Button onClick={saveWeight}>Simpan Bobot</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        type="pekerjaan"
        id={cancelId}
        version={cancelVersion}
        onSuccess={() => {
          setCancelOpen(false);
        }}
      />
    </div>
  );
}
