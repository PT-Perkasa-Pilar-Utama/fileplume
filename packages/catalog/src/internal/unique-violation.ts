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
