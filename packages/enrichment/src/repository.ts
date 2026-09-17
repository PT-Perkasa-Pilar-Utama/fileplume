import type { DocumentId, TenantId } from "@archiva/shared";
import type { FailureReason, ProcessingState } from "./service.ts";

export interface EnrichmentRepository {
  getState(
    tenantId: TenantId,
    documentId: DocumentId,
  ): Promise<{ state: ProcessingState; reason?: FailureReason; updatedAt: Date } | null>;
  setState(
    tenantId: TenantId,
    documentId: DocumentId,
    state: ProcessingState,
    reason?: FailureReason,
  ): Promise<void>;
  replacePages(tenantId: TenantId, documentId: DocumentId, pages: string[]): Promise<void>;
  replaceTags(
    tenantId: TenantId,
    documentId: DocumentId,
    tags: { tag: string; confidence: number }[],
  ): Promise<void>;
  recordOverride(
    tenantId: TenantId,
    input: {
      documentId: DocumentId;
      field: string;
      originalValue: string | null;
      newValue: string | null;
    },
  ): Promise<void>;
  topTags(tenantId: TenantId, limit: number): Promise<{ tag: string; documentCount: number }[]>;
}
