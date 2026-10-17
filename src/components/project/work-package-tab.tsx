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

type WorkPackageView = {
  id: string;
  workItemId: string;
  name: string;
  weightPct: string;
  status: string;
  vendorId: string | null;
  cancelledDate: Date | null;
  cancelReason: string | null;
  completedDate: Date | null;
  productionStartDate: Date | null;
  version: number;
  purchaseRequest: { id: string; number: string; date: Date } | null;
  purchaseOrder: {
    id: string;
    number: string;
    date: Date;
    vendorId: string | null;
  } | null;
  items: Array<{
    id: string;
    materialId: string;
    unitId: string;
    plannedQty: string;
    order: number;
  }>;
  deliveries: Array<{
    id: string;
    deliveryDate: Date;
    isCorrection: boolean;
    correctionReason: string | null;
    items: Array<{ id: string; workPackageItemId: string; qty: string }>;
  }>;
};

interface WorkPackageTabProps {
  projectId: string;
  workPackages: WorkPackageView[];
  canWrite: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PR_SUBMITTED: "PR Diajukan",
  PO_ISSUED: "PO Diterbitkan",
  PRODUKSI: "Produksi",
  PARTIALLY_DELIVERED: "Sebagian Terkirim",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export function WorkPackageTab({
  workPackages,
  canWrite,
}: WorkPackageTabProps) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState("");
  const [cancelVersion, setCancelVersion] = useState(0);

  // Add PR dialog state
  const [prOpen, setPrOpen] = useState(false);
  const [prPackageId, setPrPackageId] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [prDate, setPrDate] = useState("");

  // Add PO dialog state
  const [poOpen, setPoOpen] = useState(false);
  const [poPackageId, setPoPackageId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [poVendorId, setPoVendorId] = useState("");

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

  async function createPR() {
    const ok = await call("POST", `/api/work-packages/${prPackageId}/pr`, {
      number: prNumber,
      date: prDate,
    });
    if (ok) {
      setPrOpen(false);
      setPrNumber("");
      setPrDate("");
      toast.success("PR dibuat");
    }
  }

  async function createPO() {
    const ok = await call("POST", `/api/work-packages/${poPackageId}/po`, {
      number: poNumber,
      date: poDate,
      vendorId: poVendorId,
    });
    if (ok) {
      setPoOpen(false);
      setPoNumber("");
      setPoDate("");
      setPoVendorId("");
      toast.success("PO dibuat");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Paket Kerja</h3>

        {workPackages.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Belum ada Paket Kerja untuk proyek ini.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paket Kerja</TableHead>
                <TableHead className="text-right">Bobot</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">PR</TableHead>
                <TableHead className="text-right">PO</TableHead>
                <TableHead className="text-center">Kirim</TableHead>
                {canWrite ? (
                  <TableHead className="text-right">Aksi</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workPackages.map((wp) => (
                <TableRow key={wp.id}>
                  <TableCell>{wp.name}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPercent(wp.weightPct)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {STATUS_LABEL[wp.status] ?? wp.status}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {wp.purchaseRequest?.number ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {wp.purchaseOrder?.number ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {wp.deliveries.length > 0 ? wp.deliveries.length : "—"}
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="text-right">
                      <div className="flex flex-col gap-1">
                        {wp.status === "DRAFT" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setCancelId(wp.id);
                              setCancelVersion(wp.version);
                              setCancelOpen(true);
                            }}
                          >
                            Batalkan
                          </Button>
                        )}
                        {wp.status === "PR_SUBMITTED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPoPackageId(wp.id);
                              setPoOpen(true);
                            }}
                          >
                            Buat PO
                          </Button>
                        )}
                        {(wp.status === "PO_ISSUED" ||
                          wp.status === "PRODUKSI") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPrPackageId(wp.id);
                              setPrOpen(true);
                            }}
                          >
                            Buat PR
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        type="paket"
        id={cancelId}
        version={cancelVersion}
        onSuccess={() => {
          setCancelOpen(false);
        }}
      />

      {prOpen && (
        <Dialog open={prOpen} onOpenChange={setPrOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat PR</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label>Nomor PR</Label>
                <Input
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={prDate}
                  onChange={(e) => setPrDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPrOpen(false)}>
                Batal
              </Button>
              <Button onClick={createPR}>Buat PR</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {poOpen && (
        <Dialog open={poOpen} onOpenChange={setPoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat PO</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label>Nomor PO</Label>
                <Input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Vendor</Label>
                <Input
                  value={poVendorId}
                  onChange={(e) => setPoVendorId(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPoOpen(false)}>
                Batal
              </Button>
              <Button onClick={createPO}>Buat PO</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
