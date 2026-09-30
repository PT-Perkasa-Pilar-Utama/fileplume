import type { DocumentId, TenantId, UserId, VersionId } from "@archiva/shared";

export interface MalwareScanner {
  scan(stream: ReadableStream): Promise<{ infected: boolean; signature?: string }>;
}

export interface ScanBlobStore {
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
}

export interface ScanCatalogRepository {
  markScanComplete(
    tenantId: TenantId,
    documentId: DocumentId,
    versionId: VersionId,
  ): Promise<boolean>;
  markMalwareDetected(
    tenantId: TenantId,
    documentId: DocumentId,
    versionId: VersionId,
    signature: string,
  ): Promise<boolean>;
  deleteDocument(tenantId: TenantId, documentId: DocumentId): Promise<void>;
}

export interface ScanQuotaPort {
  revertCommittedDocumentQuota(reservation: {
    documentId: DocumentId;
    tenantId: TenantId;
    bytes: number;
  }): Promise<void>;
}

export interface ScanAuditPort {
  record(event: {
    tenantId: TenantId;
    actorId: UserId | null;
    action: "malware.detected";
    subjectType: string;
    subjectId: string | null;
    outcome: "denied";
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface TextExtractor {
  extract(
    stream: ReadableStream,
    mimeType: string,
  ): Promise<{ pages: string[]; method: "native" | "ocr" | "mixed"; language?: string }>;
}

export interface AiProvider {
  classify(text: string, categories: string[]): Promise<{ category: string; confidence: number }>;
  tag(text: string): Promise<{ tag: string; confidence: number }[]>;
}

export interface JobQueue {
  enqueue(name: string, payload: unknown, jobId: string): Promise<void>;
}
