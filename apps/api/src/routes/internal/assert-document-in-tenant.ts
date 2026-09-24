import { AppError } from "@archiva/shared";
import type { Context } from "hono";
import type { AppEnv } from "../../middleware/context.ts";
import { isDocumentInTenant } from "../mocks.ts";

/**
 * 5.5, 5.9: A denied cross-tenant attempt writes an access.denied audit event
 * against the caller's own tenant with { attemptedId: id } in metadata, and
 * returns 404, never 403 (AC-43.03, AC-43.04).
 */
export async function assertDocumentInTenant(
  c: Context<AppEnv>,
  documentId: string,
): Promise<void> {
  const tenant = c.get("tenant");
  const session = c.get("session");
  if (!isDocumentInTenant(documentId, tenant?.id ?? null)) {
    if (session.kind === "authenticated" && session.principal.tenantId !== null) {
      await c.get("activity").record({
        tenantId: session.principal.tenantId,
        actorId: session.principal.userId,
        action: "access.denied",
        subjectType: "document",
        subjectId: null,
        outcome: "denied",
        metadata: { attemptedId: documentId },
      });
    }
    throw new AppError("NOT_FOUND");
  }
}
