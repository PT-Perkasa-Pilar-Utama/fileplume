import { AppError, ERROR_MESSAGES, type ErrorCode } from "@archiva/shared";
import type { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

/** api-specs/01-conventions.md 1.6. Never a stack trace, never a driver message. */
export function fail(c: Context, code: ErrorCode, details?: unknown) {
  const error = new AppError(code, details);
  return c.json(
    { error: { code, message: error.message, ...(details ? { details } : {}) } },
    error.status as 400,
  );
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.status as 400,
    );
  }

  // Middleware such as bearerAuth signals with an HTTPException. Its status is
  // the answer; swallowing it into a 500 would report a fault where the caller
  // was simply refused.
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.error({ msg: "unhandled", err: err.message });
  return c.json({ error: { code: "INTERNAL_ERROR", message: ERROR_MESSAGES.INTERNAL_ERROR } }, 500);
};
