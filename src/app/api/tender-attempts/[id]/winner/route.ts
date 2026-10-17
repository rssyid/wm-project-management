import { ok, toErrorResponse } from "@/app/api/_lib/respond";
import { requirePermission, parseJson } from "@/app/api/_lib/session";
import { setTenderWinner } from "@/domain/tender/service";
import { setTenderWinnerSchema } from "@/shared/schemas/procurement";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requirePermission(request, "project.write");
    const { id } = await context.params;
    const input = await parseJson(request, setTenderWinnerSchema);
    return ok(
      await setTenderWinner(
        id,
        input.vendorId ?? null,
        input.vendorName ?? null,
        user.id,
      ),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
