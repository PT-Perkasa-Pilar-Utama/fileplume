import type { DocumentId, Result, TenantId, UserId } from "@archiva/shared";
import type * as E from "./errors.ts";
import type { AiProvider, JobQueue, MalwareScanner, TextExtractor } from "./ports.ts";
import type { EnrichmentRepository } from "./repository.ts";

/** technical-specs/12-document-processing-pipeline.md 12.1. Nothing else exists. */
export type ProcessingState = "queued" | "processing" | "ready" | "failed";

export type FailureReason =
  | "password_protected"
  | "unreadable_content"
  | "extraction_timeout"
  | "ai_unavailable"
  | "index_failed";

/** Fixed, not configurable. Scanning first is a security property. */
export const STAGES = ["scan", "extract", "classify", "index"] as const;

export const MAX_TAGS = 3;

export type AiField = "category" | "document_type" | "tag" | "author" | "extracted_field";

/** technical-specs/06-data-model.md 6.8: document_text.extraction_method. */
export type ExtractionMethod = "native" | "ocr" | "mixed";

/** technical-specs/06-data-model.md 6.8: document_tags.source. */
export type TagSource = "ai" | "user";

/** The Indonesian labels AC-44.01 enumerates. Served, never mapped client-side. */
export const STATE_LABEL: Record<ProcessingState, string> = {
  queued: "Antre",
  processing: "Diproses",
  ready: "Siap",
  failed: "Gagal",
};

export const FAILURE_MESSAGE: Record<FailureReason, string> = {
  password_protected: "Dokumen terproteksi password",
  unreadable_content: "Isi dokumen tidak dapat dibaca",
  extraction_timeout: "Proses ekstraksi melebihi batas waktu",
  ai_unavailable: "Layanan AI tidak tersedia",
  index_failed: "Dokumen gagal diindeks",
};

/** Network, timeout, 5xx and rate limit retry. Bad input does not. */
export function isTransient(reason: FailureReason): boolean {
  return (
    reason === "extraction_timeout" || reason === "ai_unavailable" || reason === "index_failed"
  );
}

/** A guard, so a delayed duplicate job cannot move a READY document backwards. */
export function canTransition(from: ProcessingState, to: ProcessingState): boolean {
  const allowed: Record<ProcessingState, ProcessingState[]> = {
    queued: ["processing"],
    processing: ["processing", "ready", "failed"],
    ready: ["queued"],
    failed: ["queued"],
  };
  return allowed[from].includes(to);
}

/** Truncated at write time, not read time, so extra rows cannot leak through. */
export function truncateTags<T extends { confidence: number }>(tags: T[]): T[] {
  return [...tags].sort((a, b) => b.confidence - a.confidence).slice(0, MAX_TAGS);
}

export interface EnrichmentService {
  enqueue(documentId: DocumentId): Promise<void>;
  process(documentId: DocumentId): Promise<void>;
  getState(
    documentId: DocumentId,
  ): Promise<{ state: ProcessingState; reason?: FailureReason; updatedAt: Date }>;
  overrideField(
    documentId: DocumentId,
    field: AiField,
    value: string | null,
    actor: UserId,
  ): Promise<Result<void, E.Forbidden | E.NotFound>>;
  topTags(tenantId: TenantId, limit?: number): Promise<{ tag: string; documentCount: number }[]>;
}

export function createEnrichmentService(_deps: {
  repository: EnrichmentRepository;
  scanner: MalwareScanner;
  extractor: TextExtractor;
  ai: AiProvider;
  queue: JobQueue;
}): EnrichmentService {
  throw new Error("SCAFFOLD: implement in BE-S3-01, BE-S3-02, BE-S3-04, BE-S3-06, BE-S3-07");
}
