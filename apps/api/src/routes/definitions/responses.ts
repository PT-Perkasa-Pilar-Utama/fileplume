import { errorSchema } from "@archiva/shared";
import { z } from "zod";

/** Security requirements; the schemes are registered in openapi.ts. */
export const SESSION = [{ session: [] }];
export const HEALTH_TOKEN = [{ healthToken: [] }];
export const RESET_TOKEN = [{ resetToken: [] }];

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export const jsonBody = <T extends z.ZodType>(schema: T, required = true) => ({
  required,
  content: { "application/json": { schema } },
});

export const multipartBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "multipart/form-data": { schema } },
});

const binarySchema = z.string().meta({ format: "binary" });

/** A byte stream, not a JSON envelope. api-specs/01-conventions.md 1.2. */
export const binary = (mediaType: string, description: string) => ({
  description,
  content: { [mediaType]: { schema: binarySchema } },
});

const failure = (description: string) => json(errorSchema, description);

export const ERROR_400 = { 400: failure("Malformed request, or a truncated upload") };
export const ERROR_401 = { 401: failure("No session, or the session expired or was revoked") };
export const ERROR_404 = {
  404: failure("Absent, hidden, or in another tenant; indistinguishable by design"),
};
export const ERROR_409 = { 409: failure("State conflict") };
export const ERROR_413 = { 413: failure("Body exceeded the transport cap") };
export const ERROR_422 = { 422: failure("Validation failed, or the request was refused") };
export const ERROR_429 = { 429: failure("Rate limit reached; Retry-After is in seconds") };
export const ERROR_503 = { 503: failure("A required dependency is unreachable") };

/** A route with a role floor can refuse on the session and on the floor before its handler. */
export const GUARDED = {
  ...ERROR_401,
  403: failure("Refused inside the tenant; a denied audit event is written"),
};
