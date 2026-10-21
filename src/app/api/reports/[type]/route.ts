import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission } from "@/app/api/_lib/session";
import { listProjects } from "@/domain/project/queries";
import { projectFiltersSchema } from "@/shared/schemas/project";
import { DomainError } from "@/shared/errors";

type Context = { params: Promise<{ type: string }> };

const REPORT_TYPES = ["portfolio", "project-detail", "work-packages", "ews-red"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "read");
    const { type } = await context.params;
    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw new DomainError("VALIDATION_ERROR", "Jenis laporan tidak dikenal.");
    }
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const filters = projectFiltersSchema.parse(query);
    const format = query.format === "pdf" ? "pdf" : "json";
    const { data } = await listProjects(filters);

    let result: unknown;
    if (type === "portfolio") {
      result = {
        projects: data.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
        })),
      };
    } else if (type === "project-detail") {
      result = { projects: data };
    } else if (type === "work-packages") {
      result = {
        projects: data.map((p) => ({ id: p.id, code: p.code, workPackages: [] })),
      };
    } else {
      result = {
        projects: data.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          ews: null,
        })),
      };
    }

    if (format === "pdf") {
      const buffer = Buffer.from(JSON.stringify(result, null, 2));
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${type}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    }
    if (query.format === "xlsx") {
      const buffer = Buffer.from(JSON.stringify(result, null, 2));
      return new Response(buffer, {
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
