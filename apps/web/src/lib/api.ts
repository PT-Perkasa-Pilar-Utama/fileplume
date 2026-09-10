/**
 * Typed client. Generated from the OpenAPI document the api emits from the same
 * Zod schemas its handlers validate against, so the client cannot drift from
 * the server. Generation is wired in TL-S0-07.
 */
export const API_BASE = "/api/v1";

export type Envelope<T> = { data: T };
export type Collection<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    message?: string | null;
    notice?: string | null;
  };
};
export type ApiError = { error: { code: string; message: string; details?: unknown } };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  const body = (await res.json()) as T | ApiError;
  if (!res.ok) throw new Error((body as ApiError).error.message);
  return body as T;
}
