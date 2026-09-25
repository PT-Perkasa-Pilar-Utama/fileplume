import type { CatalogService } from "@archiva/catalog";
import { AppError, asDocumentId } from "@archiva/shared";
import type { Context } from "hono";
import type { AppEnv } from "../../middleware/context.ts";
import { isDocumentInTenant } from "../mocks.ts";

/**
 * Asserts documentId belongs to tenantId. On failure, records access.denied
 * against the caller's own tenant with { attemptedId: id } in metadata, and
 * returns 404, never 403 (AC-43.03, AC-43.04).
 */
export async function assertDocumentInTenant(
  c: Context<AppEnv>,
  catalog: CatalogService,
  documentId: string,
): Promise<void> {
  const tenant = c.get("tenant");
  const session = c.get("session");
  const doc = tenant ? await catalog.findDocument(tenant.id, asDocumentId(documentId)) : null;
  if (!doc && !isDocumentInTenant(documentId, tenant?.id ?? null)) {
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
