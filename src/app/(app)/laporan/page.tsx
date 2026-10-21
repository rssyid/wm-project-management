"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type ReportOption = {
  id: string;
  label: string;
  description: string;
};

const REPORTS: ReportOption[] = [
  {
    id: "portfolio",
    label: "Laporan Portofolio",
    description: "Ringkasan semua proyek dengan status dan progres.",
  },
  {
    id: "project-detail",
    label: "Laporan Detail Proyek",
    description: "Detail lengkap proyek termasuk anggaran dan AFCE.",
  },
  {
    id: "work-packages",
    label: "Laporan Paket Kerja",
    description: "Status paket kerja, PR, PO, dan kiriman.",
  },
  {
    id: "ews-red",
    label: "Laporan EWS Merah",
    description: "Proyek dengan deviasi progres dalam status merah.",
  },
];

export default function ReportsPage() {
  const [selected, setSelected] = useState<string>("portfolio");
  const [downloading, setDownloading] = useState<string | null>(null);

  const report = REPORTS.find((r) => r.id === selected);

  const handleDownload = async (fmt: "json" | "xlsx" | "pdf") => {
    setDownloading(report!.id);
    try {
      const response = await fetch(`/api/reports/${report!.id}?format=${fmt}`);
      if (!response.ok) throw new Error("Gagal mengunduh laporan.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report!.id}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Empat laporan dengan ekspor Excel dan PDF."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div
            key={r.id}
            className={`rounded-sm border border-line p-4 ${
              selected === r.id
                ? "border-canal bg-canal-soft"
                : "bg-panel hover:border-canal"
            }`}
            onClick={() => setSelected(r.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(r.id);
              }
            }}
          >
            <h3 className="mb-1 text-base font-semibold">{r.label}</h3>
            <p className="text-sm text-ink-muted">{r.description}</p>
          </div>
        ))}
      </div>

      {report && (
        <section className="mt-6 rounded-sm border border-line bg-panel p-6">
          <h2 className="mb-3 text-base font-semibold">
            Pratinjau: {report.label}
          </h2>
          <p className="mb-4 text-sm text-ink-muted">
            Pilih format unduh: JSON, Excel, atau PDF.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleDownload("json")}
              disabled={downloading === report.id}
            >
              {downloading === report.id ? "Mengunduh…" : "Unduh JSON"}
            </Button>
            <Button
              onClick={() => handleDownload("xlsx")}
              disabled={downloading === report.id}
            >
              {downloading === report.id ? "Mengunduh…" : "Unduh Excel"}
            </Button>
            <Button
              onClick={() => handleDownload("pdf")}
              disabled={downloading === report.id}
            >
              {downloading === report.id ? "Mengunduh…" : "Unduh PDF"}
            </Button>
          </div>
          <Separator className="my-4" />
          <div className="text-sm text-ink-muted">
            Pilih format dari tombol di atas. File akan diunduh dengan nama
            <code>
              {report.id}.json | {report.id}.xlsx | {report.id}.pdf
            </code>
            .
          </div>
        </section>
      )}
    </>
  );
}
