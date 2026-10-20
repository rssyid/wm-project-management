import { ZodError } from "zod";

import { DomainError, ERROR_STATUS, type ErrorCode } from "@/shared/errors";

type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
};

export function ok<T>(
  data: T,
  meta?: { page: number; pageSize: number; total: number },
) {
  return Response.json({ data, ...(meta ? { meta } : {}) });
}

export function errorBody(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string>,
): ErrorBody {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

/**
 * docs/02 §4: semua error dari route handler melewati sini, jadi pemetaan ke HTTP hanya di
 * satu tempat. 403 hanya untuk role; gate, prasyarat, dan konflik selalu 409.
 */
/**
 * Sinyal prerender Next (bail-out dinamis, connection() saat prerender) bukan kegagalan request.
 * Dilempar ulang supaya framework menandai route sebagai dinamis, bukan dijadikan 500.
 */
const PRERENDER_SIGNAL_DIGESTS = new Set([
  "HANGING_PROMISE_REJECTION",
  "NEXT_PRERENDER_INTERRUPTED",
]);

function isPrerenderSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string" && PRERENDER_SIGNAL_DIGESTS.has(digest)) {
    return true;
  }
  return (
    error instanceof Error &&
    error.message.includes("needs to bail out of prerendering")
  );
}

export function toErrorResponse(error: unknown): Response {
  if (isPrerenderSignal(error)) throw error;

  if (error instanceof DomainError) {
    return Response.json(errorBody(error.code, error.message, error.fields), {
      status: ERROR_STATUS[error.code],
    });
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      fields[issue.path.join(".")] = issue.message;
    }
    return Response.json(
      errorBody(
        "VALIDATION_ERROR",
        "Periksa kembali isian yang ditandai.",
        fields,
      ),
      { status: ERROR_STATUS.VALIDATION_ERROR },
    );
  }

  const prismaCode = (error as { code?: string } | null)?.code;
  if (prismaCode === "P2002") {
    return Response.json(
      errorBody("DUPLICATE", "Data dengan kode atau nama yang sama sudah ada."),
      { status: ERROR_STATUS.DUPLICATE },
    );
  }
  if (prismaCode === "P2025") {
    return Response.json(errorBody("NOT_FOUND", "Data tidak ditemukan."), {
      status: ERROR_STATUS.NOT_FOUND,
    });
  }

  console.error(error);
  return Response.json(
    errorBody(
      "INTERNAL_ERROR",
      "Terjadi kesalahan. Coba lagi atau hubungi Super Admin.",
    ),
    { status: ERROR_STATUS.INTERNAL_ERROR },
  );
}
