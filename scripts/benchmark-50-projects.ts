import "./env";

import { prisma } from "@/infra/db";
import { listProjects, getProject } from "@/domain/project/queries";
import { getPortfolioGantt } from "@/domain/gantt/queries";
import { projectFiltersSchema } from "@/shared/schemas/project";
import { ensureSeed, createUser } from "../tests/integration/helpers/factory";
import { GET as reportRoute } from "@/app/api/reports/[type]/route";
import { auth } from "@/infra/auth";

type BenchmarkMetric = {
  ac: string;
  name: string;
  target: string;
  actual: string;
  status: "PASS" | "FAIL" | "INFO";
  notes?: string;
};

async function signIn(email: string, password: string): Promise<string> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
}

async function main() {
  console.log("=== Memulai Uji Performa 50 Proyek (AC-58 & AC-71) ===");

  await ensureSeed();

  const user = await createUser({ role: "WM_HO_SPECIALIST" });
  const cookie = await signIn(user.email, user.password);

  const totalActive = await prisma.project.count({
    where: { deletedAt: null },
  });
  console.log(`Total proyek aktif di basis data: ${totalActive}`);

  if (totalActive < 50) {
    throw new Error(
      `Diperlukan minimal 50 proyek di basis data untuk uji performa, saat ini: ${totalActive}`,
    );
  }

  const metrics: BenchmarkMetric[] = [];

  // 1. AC-71: Halaman Utama (Daftar 50 Proyek)
  console.log(
    "\n[1/3] Menguji AC-71: Query Halaman Utama (daftar 50 proyek)...",
  );
  const filters50 = projectFiltersSchema.parse({ page: 1, pageSize: 50 });
  const t0 = performance.now();
  const listResult = await listProjects(filters50);
  const t1 = performance.now();
  const listDurationMs = t1 - t0;
  console.log(
    `  listProjects selesai: ${listResult.data.length} proyek termuat dalam ${listDurationMs.toFixed(1)} ms`,
  );
  metrics.push({
    ac: "AC-71",
    name: "Halaman Utama: listProjects (50 proyek)",
    target: "< 3.000 ms (< 3,0 detik)",
    actual: `${listDurationMs.toFixed(1)} ms`,
    status: listDurationMs < 3000 ? "PASS" : "FAIL",
    notes: `Total proyek di DB: ${listResult.total}`,
  });

  // 2. AC-71: Detail Proyek (getProject workspace)
  console.log("\n[2/3] Menguji AC-71: Query Detail Proyek (workspace)...");
  const sampleProjectId = listResult.data[0]?.id;
  if (!sampleProjectId) throw new Error("Tidak ada proyek untuk diuji detail");
  const t2 = performance.now();
  const projectDetail = await getProject(sampleProjectId);
  const t3 = performance.now();
  const detailDurationMs = t3 - t2;
  console.log(
    `  getProject selesai untuk ${projectDetail?.code} dalam ${detailDurationMs.toFixed(1)} ms`,
  );
  metrics.push({
    ac: "AC-71",
    name: "Detail Proyek: getProject (workspace)",
    target: "< 3.000 ms (< 3,0 detik)",
    actual: `${detailDurationMs.toFixed(1)} ms`,
    status: detailDurationMs < 3000 ? "PASS" : "FAIL",
    notes: `Proyek ID: ${sampleProjectId}`,
  });

  // Metrik Tambahan / Diagnostik: Gantt Portofolio (10 proyek)
  console.log("\n[Diagnostik] Menguji query Gantt Portofolio (10 proyek)...");
  const filters10 = projectFiltersSchema.parse({ page: 1, pageSize: 10 });
  const t4 = performance.now();
  const portfolioGantt = await getPortfolioGantt(filters10);
  const t5 = performance.now();
  const portfolioDurationMs = t5 - t4;
  console.log(
    `  getPortfolioGantt selesai: ${portfolioGantt.length} proyek Gantt dalam ${portfolioDurationMs.toFixed(1)} ms`,
  );
  metrics.push({
    ac: "Diagnostik UI",
    name: "Portofolio Gantt (10 proyek pertama)",
    target: "Responsif (< 3.000 ms)",
    actual: `${portfolioDurationMs.toFixed(1)} ms`,
    status: portfolioDurationMs < 3000 ? "PASS" : "INFO",
    notes: `${portfolioGantt.length} blok proyek Gantt`,
  });

  // 3. AC-58: Ekspor 4 Laporan (Excel & PDF) untuk 50 proyek
  console.log(
    "\n[3/3] Menguji AC-58: Ekspor 4 laporan Excel & PDF untuk 50 proyek...",
  );
  const reportTypes = [
    "portfolio",
    "project-detail",
    "work-packages",
    "ews-red",
  ] as const;

  let totalExportDurationSec = 0;

  for (const repType of reportTypes) {
    // Test Excel
    const tStartExcel = performance.now();
    const reqExcel = new Request(
      `http://localhost:3000/api/reports/${repType}?format=xlsx&pageSize=50`,
      { headers: { cookie } },
    );
    const resExcel = await reportRoute(reqExcel, {
      params: Promise.resolve({ type: repType }),
    });
    if (resExcel.status !== 200) {
      throw new Error(
        `Gagal ekspor XLSX laporan ${repType}: HTTP ${resExcel.status}`,
      );
    }
    const xlsxBlob = await resExcel.arrayBuffer();
    const tEndExcel = performance.now();
    const durExcelSec = (tEndExcel - tStartExcel) / 1000;
    totalExportDurationSec += durExcelSec;
    console.log(
      `  Ekspor XLSX ${repType}: ${xlsxBlob.byteLength} bytes dalam ${durExcelSec.toFixed(2)} detik`,
    );

    // Test PDF
    const tStartPdf = performance.now();
    const reqPdf = new Request(
      `http://localhost:3000/api/reports/${repType}?format=pdf&pageSize=50`,
      { headers: { cookie } },
    );
    const resPdf = await reportRoute(reqPdf, {
      params: Promise.resolve({ type: repType }),
    });
    if (resPdf.status !== 200) {
      throw new Error(
        `Gagal ekspor PDF laporan ${repType}: HTTP ${resPdf.status}`,
      );
    }
    const pdfBlob = await resPdf.arrayBuffer();
    const tEndPdf = performance.now();
    const durPdfSec = (tEndPdf - tStartPdf) / 1000;
    totalExportDurationSec += durPdfSec;
    console.log(
      `  Ekspor PDF ${repType}: ${pdfBlob.byteLength} bytes dalam ${durPdfSec.toFixed(2)} detik`,
    );
  }

  console.log(
    `\nTotal waktu ekspor 4 laporan (XLSX + PDF): ${totalExportDurationSec.toFixed(2)} detik`,
  );
  metrics.push({
    ac: "AC-58",
    name: "Total Ekspor 4 Laporan (XLSX + PDF)",
    target: "< 300,0 detik (< 5 menit)",
    actual: `${totalExportDurationSec.toFixed(2)} detik`,
    status: totalExportDurationSec < 300 ? "PASS" : "FAIL",
    notes: "4 laporan x 2 format = 8 dokumen untuk 50 proyek",
  });

  console.log("\n================ HASIL BENCHMARK ================");
  console.table(metrics);

  const criteriaToCheck = metrics.filter((m) => m.status !== "INFO");
  const allPassed = criteriaToCheck.every((m) => m.status === "PASS");
  if (!allPassed) {
    console.error("FAIL: Ada kriteria performa yang tidak memenuhi target!");
    process.exit(1);
  } else {
    console.log("SUCCESS: Seluruh kriteria performa AC-58 & AC-71 LULUS 100%!");
  }
}

main().catch((err) => {
  console.error("Error pada saat benchmark:", err);
  process.exit(1);
});
