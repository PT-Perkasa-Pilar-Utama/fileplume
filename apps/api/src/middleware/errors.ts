import type { ErrorCode, ErrorDetail } from "@archiva/shared";
import { AppError, formatErrorMessage, HTTP_STATUS } from "@archiva/shared";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodError } from "zod";

/** Statuses that framework middleware signals with an HTTPException, named in the taxonomy. */
const CODE_FOR_STATUS: Partial<Record<number, ErrorCode>> = {
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMITED",
};

function errorBody(code: ErrorCode, message: string, details?: ErrorDetail[]) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/** api-specs/01-conventions.md 1.6. Never a stack trace, never a driver message. */
export function fail(c: Context, code: ErrorCode, details?: ErrorDetail[]): Response {
  // Hono types the status as a literal union; HTTP_STATUS holds only 1.7 codes.
  return c.json(errorBody(code, formatErrorMessage(code), details), HTTP_STATUS[code] as 400);
}

function fieldOf(path: readonly PropertyKey[]): string {
  return path.reduce<string>((field, key) => {
    if (typeof key === "number") return `${field}[${key}]`;
    return field === "" ? String(key) : `${field}.${String(key)}`;
  }, "");
}

/** 1.8 `VALIDATION_ERROR`: one `details` entry per Zod issue, `files[2]` style paths. */
export function validationFailed(c: Context, error: ZodError): Response {
  const details = error.issues.map((issue) => ({ field: fieldOf(issue.path), issue: issue.code }));
  return fail(c, "VALIDATION_ERROR", details);
}

type ValidationResult = { success: true } | { success: false; error: ZodError };

/** The defaultHook of every router. A passing request continues to the handler. */
export function validationHook(result: ValidationResult, c: Context): Response | undefined {
  return result.success ? undefined : validationFailed(c, result.error);
}

export const notFound: NotFoundHandler = (c) => fail(c, "NOT_FOUND");

function fromHttpException(c: Context, err: HTTPException): Response {
  const upstream = err.getResponse();
  const code = CODE_FOR_STATUS[err.status];
  if (code === undefined) return upstream;
  const challenge = upstream.headers.get("WWW-Authenticate");
  if (challenge !== null) c.header("WWW-Authenticate", challenge);
  return fail(c, code);
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    // Hono types the status as a literal union; AppError.status comes from HTTP_STATUS.
    return c.json(errorBody(err.code, err.message, err.details), err.status as 400);
  }
  if (err instanceof HTTPException) return fromHttpException(c, err);

  console.error({ msg: "unhandled", err: err.message });
  return fail(c, "INTERNAL_ERROR");
};
