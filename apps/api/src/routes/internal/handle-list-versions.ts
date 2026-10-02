import type { CatalogService } from "@archiva/catalog";
import type { DocumentVersionView } from "@archiva/shared";
import { AppError, asDocumentId } from "@archiva/shared";
import type { TenancyService } from "@archiva/tenancy";
import type { Context } from "hono";
import type { AppEnv } from "../../middleware/context.ts";

export async function handleListVersions(
  c: Context<AppEnv>,
  catalog: CatalogService,
  tenancy: Pick<TenancyService, "getConfigValue">,
  id: string,
): Promise<DocumentVersionView[]> {
  const tenant = c.get("tenant");
  if (!tenant) throw new AppError("NOT_FOUND");
  const principal = c.get("principal");
  const pendingConfirmationDays = await tenancy.getConfigValue(
    tenant.id,
    "pending_confirmation_days",
  );

  const result = await catalog.getDocument(
    tenant.id,
    asDocumentId(id),
    {
      userId: principal.userId,
      role: principal.role,
    },
    pendingConfirmationDays,
  );

  if (!result.ok) {
    if (result.error.crossTenantAttempt && principal.tenantId !== null) {
      await c.get("activity").record({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: "access.denied",
        subjectType: "document",
        subjectId: null,
        outcome: "denied",
        metadata: { attemptedId: id },
      });
    }
    throw new AppError("NOT_FOUND");
  }

  return result.value.versions;
}
