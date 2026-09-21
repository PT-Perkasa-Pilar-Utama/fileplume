import type { DocumentId, Result, TenantId, UserId } from "@archiva/shared";
import type { QuotaExceeded } from "./errors.ts";

export interface BlobStore {
  put(key: string, stream: ReadableStream): Promise<{ sizeBytes: number; sha256: string }>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
}

export interface DocumentConverter {
  toPdf(source: ReadableStream, mimeType: string): Promise<ReadableStream>;
}

export interface Clock {
  now(): Date;
}

export type QuotaReservationToken = {
  id: string;
  tenantId: TenantId;
  bytes: number;
};

export interface QuotaPort {
  getMaxFileSizeMb(tenantId: TenantId): Promise<number>;
  reserveQuota(
    tenantId: TenantId,
    bytes: number,
  ): Promise<Result<QuotaReservationToken, QuotaExceeded>>;
  commitQuota(reservation: QuotaReservationToken): Promise<void>;
  releaseQuota(reservation: QuotaReservationToken): Promise<void>;
}

export interface JobQueue {
  enqueue(documentId: DocumentId): Promise<void>;
}

export interface AuditPort {
  record(event: {
    tenantId: TenantId;
    actorId: UserId;
    action: "document.upload";
    subjectType: "document";
    subjectId: DocumentId;
    outcome: "allowed";
    metadata: { filename: string; sizeBytes: number; mimeType: string };
  }): Promise<void>;
}
