import type { DocumentId, Result, TenantId, UserId, VersionId } from "@archiva/shared";
import type { TextExtractionFailure } from "./errors.ts";
import type { ExtractionMethod } from "./service.ts";

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

export type ExtractedText = {
  pages: string[];
  method: ExtractionMethod;
  /** technical-specs/06-data-model.md 6.8: document_text.language. */
  language?: "ind" | "eng" | "mixed";
};

export interface TextExtractor {
  extract(
    stream: ReadableStream,
    mimeType: string,
  ): Promise<Result<ExtractedText, TextExtractionFailure>>;
}

/** technical-specs/10-integration-points.md 10.7: page image in, text plus confidence out. */
export interface OcrProvider {
  recognize(
    image: Uint8Array,
    languages: readonly ["ind", "eng"],
  ): Promise<{ text: string; confidence: number }>;
}

/** Renders one PDF page to an image for OCR. Never called for a page with a text layer. */
export interface PdfPageRenderer {
  render(pdf: Uint8Array, pageNumber: number): Promise<Uint8Array>;
}

export interface ExtractBlobStore {
  get(key: string): Promise<ReadableStream>;
}

/** The per-version derived text the extract stage persists. technical-specs/06-data-model.md 6.8. */
export type ExtractedDocument = {
  tenantId: TenantId;
  documentId: DocumentId;
  versionId: VersionId;
  pages: string[];
  method: ExtractionMethod;
  language?: "ind" | "eng" | "mixed";
};

export interface ExtractionRepository {
  /**
   * Replaces this version's derived rows atomically: document_text, its ordered
   * document_pages rows, and document_versions.page_count. Other versions are
   * untouched (technical-specs/12-document-processing-pipeline.md 12.1).
   */
  replaceExtractedText(document: ExtractedDocument): Promise<void>;
}

export interface AiProvider {
  classify(text: string, categories: string[]): Promise<{ category: string; confidence: number }>;
  tag(text: string): Promise<{ tag: string; confidence: number }[]>;
}

export interface JobQueue {
  enqueue(name: string, payload: unknown, jobId: string): Promise<void>;
}
