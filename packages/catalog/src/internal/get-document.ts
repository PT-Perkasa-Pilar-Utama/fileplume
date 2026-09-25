import type { DocumentDetailView, DocumentId, Result, TenantId } from "@archiva/shared";
import { err, ok } from "@archiva/shared";
import type * as E from "../errors.ts";
import type { CatalogRepository } from "../repository.ts";
import { toDocumentDetailView } from "./document-views.ts";
import type { ViewerContext } from "./list-document-query.ts";

export async function handleGetDocument(
  repository: CatalogRepository,
  tenantId: TenantId,
  documentId: DocumentId,
  viewer: ViewerContext,
  pendingConfirmationDays: number,
  now = new Date(),
): Promise<Result<DocumentDetailView, E.NotFound>> {
  const detail = await repository.findDocumentDetail(
    tenantId,
    documentId,
    viewer,
    pendingConfirmationDays,
    now,
  );

  if (!detail) {
    return err({ kind: "NotFound" });
  }

  if ("kind" in detail) {
    return err({ kind: "NotFound", crossTenantAttempt: true });
  }

  return ok(toDocumentDetailView(detail));
}
