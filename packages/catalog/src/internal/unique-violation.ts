import type { DocumentId, Result } from "@archiva/shared";
import { err } from "@archiva/shared";
import type * as E from "../errors.ts";

/**
 * Detects a PostgreSQL unique_violation (23505) on a named constraint.
 * Handles both Bun SQL (`errno: "23505"`) and standard drivers (`code: "23505"`).
 */
export function isUniqueViolationOn(caughtErr: unknown, constraint: string): boolean {
  if (typeof caughtErr !== "object" || caughtErr === null) return false;
  const target: object =
    "cause" in caughtErr && typeof caughtErr.cause === "object" && caughtErr.cause !== null
      ? caughtErr.cause
      : caughtErr;

  if (!("constraint" in target) || target.constraint !== constraint) return false;

  return (
    ("errno" in target && target.errno === "23505") || ("code" in target && target.code === "23505")
  );
}

export async function toDuplicateContentError(
  caughtErr: unknown,
  tenantId: string,
  hash: string,
  findByHash: (tenantId: string, hash: string) => Promise<DocumentId | null>,
): Promise<Result<never, E.DuplicateContent>> {
  if (isUniqueViolationOn(caughtErr, "document_versions_tenant_hash_key")) {
    const existingId = await findByHash(tenantId, hash);
    return existingId
      ? err({ kind: "DuplicateContent" as const, existingDocumentId: existingId })
      : err({ kind: "DuplicateContent" as const });
  }
  throw caughtErr;
}
