import { ERROR_MESSAGES, errorSchema } from "@archiva/shared";
import type { z } from "zod";

/**
 * Typed client. Every response is parsed with the same Zod schema the api
 * validates against and publishes in apps/api/openapi.json, so the client
 * cannot drift from the server without a failed parse.
 */
export const API_BASE = "/api/v1";

/** A refusal in the api-specs/01-conventions.md 1.6 envelope. Branch on `code`; render `message`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  const body: unknown = res.status === 204 ? null : await res.json();
  if (res.ok) return schema.parse(body);

  const refusal = errorSchema.safeParse(body);
  if (refusal.success) {
    throw new ApiError(res.status, refusal.data.error.code, refusal.data.error.message);
  }
  throw new ApiError(res.status, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
}
