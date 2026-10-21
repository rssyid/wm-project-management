import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { listProjects } from "@/domain/project/queries";
import { getGanttProject } from "@/domain/gantt/queries";
import { projectFiltersSchema } from "@/shared/schemas/project";
import { DomainError } from "@/shared/errors";
import ExcelJS from "exceljs";

type Context = { params: Promise<{ type: string }> };

const REPORT_TYPES = ["portfolio", "project-detail", "work-packages", "ews-red"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

async function buildXlsx(type: ReportType, projects: unknown[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type);

  if (type === "portfolio") {
    sheet.columns = [
      { header: "Kode", key: "code", width: 20 },
      { header: "Nama", key: "name", width: 40 },
      { header: "Status", key: "status", width: 20 },
    ];
    for (const p of projects as Array<{ code: string; name: string; status: string }>) {
      sheet.addRow({ code: p.code, name: p.name, status: p.status });
    }
  } else if (type === "project-detail") {
    sheet.columns = [
      { header: "ID", key: "id", width: 40 },
      { header: "Kode", key: "code", width: 20 },
      { header: "Nama", key: "name", width: 40 },
      { header: "Status", key: "status", width: 20 },
    ];
    for (const p of projects as Array<{ id: string; code: string; name: string; status: string }>) {
      sheet.addRow({ id: p.id, code: p.code, name: p.name, status: p.status });
    }
  } else if (type === "work-packages") {
    sheet.columns = [
      { header: "Proyek Kode", key: "projectCode", width: 20 },
      { header: "Paket Kerja", key: "name", width: 40 },
      { header: "Status", key: "status", width: 20 },
    ];
    for (const p of projects as Array<{ projectCode: string; name: string; status: string }>) {
      sheet.addRow({ projectCode: p.projectCode, name: p.name, status: p.status });
    }
  } else {
    sheet.columns = [
      { header: "Kode", key: "code", width: 20 },
      { header: "Nama", key: "name", width: 40 },
      { header: "EWS", key: "ews", width: 20 },
    ];
    for (const p of projects as Array<{ code: string; name: string; ews: string | null }>) {
      sheet.addRow({ code: p.code, name: p.name, ews: p.ews ?? "-" });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildPdf(type: ReportType, projects: unknown[]): Buffer {
  const objects: string[] = [];
  let objNum = 1;

  const addObj = (content: string): number => {
    const n = objNum++;
    objects.push(`${n} 0 obj\n${content}\nendobj`);
    return n;
  };

  // Font object (Helvetica, built-in)
  const fontObj = addObj(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  );

  // Content stream
  let y = 740;
  const lines: string[] = [`Laporan ${type}`];
  for (const p of projects as Array<Record<string, unknown>>) {
    const line = Object.entries(p)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    lines.push(line);
  }
  const contentOps = lines
    .map((line) => `BT /F1 12 Tf 50 ${y} Td (${escapePdfString(line)}) Tj ET`)
    .join("\n");
  y -= 20 * lines.length;

  const contentObj = addObj(
    `<< /Length ${contentOps.length} >>\nstream\n${contentOps}\nendstream`,
  );

  // Page object
  const pageObj = addObj(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>`,
  );

  // Pages object
  const pagesObj = addObj(
    `<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 /MediaBox [0 0 600 800] >>`,
  );

  // Catalog object
  const catalogObj = addObj(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  // Xref
  const xrefPositions: number[] = [];
  let offset = 0;
  const header = "%PDF-1.4\n";
  offset += header.length;
  for (const obj of objects) {
    xrefPositions.push(offset);
    offset += obj.length + 1; // +1 for newline
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const pos of xrefPositions) {
    xref += `${pos.toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const pdf = header + objects.join("\n") + "\n" + xref + "\n" + trailer;
  return Buffer.from(pdf, "utf-8");
}

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { type } = await context.params;
    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw new DomainError("VALIDATION_ERROR", "Jenis laporan tidak dikenal.");
    }
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const filters = projectFiltersSchema.parse(query);
    const format =
      query.format === "pdf" ? "pdf" : query.format === "xlsx" ? "xlsx" : "json";
    const { data } = await listProjects(filters);

    const gantts = await Promise.all(data.map((p) => getGanttProject(p.id)));

    let result: unknown;
    if (type === "portfolio") {
      result = {
        projects: data.map((p, i) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          ews: gantts[i]?.rows.find((r) => r.type === "workItem")?.ewsLevel ?? null,
        })),
      };
    } else if (type === "project-detail") {
      result = {
        projects: data.map((p, i) => ({
          ...p,
          ews: gantts[i]?.rows.find((r) => r.type === "workItem")?.ewsLevel ?? null,
        })),
      };
    } else if (type === "work-packages") {
      result = {
        projects: data.map((p, i) => ({
          id: p.id,
          code: p.code,
          workPackages: gantts[i]?.rows
            .filter((r) => r.type === "workPackage")
            .map((r) => ({ name: r.label, status: r.status, progressPct: r.progressPct })),
        })),
      };
    } else {
      result = {
        projects: data.map((p, i) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          ews: gantts[i]?.rows.find((r) => r.type === "workItem")?.ewsLevel ?? null,
        })),
      };
    }

    if (format === "pdf") {
      const buffer = buildPdf(type as ReportType, data as unknown[]);
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${type}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    }
    if (format === "xlsx") {
      const buffer = await buildXlsx(type as ReportType, data as unknown[]);
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${type}.xlsx"`,
          "Content-Length": String(buffer.length),
        },
      });
    }
    return ok(result, { page: filters.page, pageSize: filters.pageSize, total: data.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
