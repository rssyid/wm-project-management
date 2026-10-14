/**
 * docs/04 §1: satu tempat memetakan error domain ke HTTP. Pesan untuk pengguna dalam
 * bahasa Indonesia dan menyebut apa yang salah serta cara memperbaikinya.
 */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN_ROLE: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  PRECONDITION_FAILED: 409,
  PROJECT_LOCKED: 409,
  FIELD_INPUT_LOCKED: 409,
  WEIGHT_MISMATCH: 409,
  DUPLICATE: 409,
  ACTIVE_CONFLICT: 409,
  VERSION_CONFLICT: 409,
  IN_USE: 409,
  FILE_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(
    code: ErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fields = fields;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
