import type { DocumentId, TenantId } from "@archiva/shared";
import type { FailureReason, ProcessingState } from "./service.ts";

export interface EnrichmentRepository {
  getState(
    documentId: DocumentId,
  ): Promise<{ state: ProcessingState; reason?: FailureReason; updatedAt: Date } | null>;
  setState(documentId: DocumentId, state: ProcessingState, reason?: FailureReason): Promise<void>;
  replacePages(documentId: DocumentId, pages: string[]): Promise<void>;
  replaceTags(documentId: DocumentId, tags: { tag: string; confidence: number }[]): Promise<void>;
  recordOverride(input: {
    documentId: DocumentId;
    field: string;
    originalValue: string | null;
    newValue: string | null;
  }): Promise<void>;
  topTags(tenantId: TenantId, limit: number): Promise<{ tag: string; documentCount: number }[]>;
}
