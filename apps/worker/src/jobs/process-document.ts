import type { DocumentId } from "@archiva/shared";

export const QUEUE_NAME = "document.process";

export type ProcessDocumentJob = { documentId: DocumentId };

/**
 * The worker entry point. Idempotent: a READY document is a no-op, because
 * BullMQ guarantees at-least-once and a redelivery must not redo the work.
 * Never throws to the caller; failures are recorded as state.
 * technical-specs/12-document-processing-pipeline.md 12.3. Card BE-S3-01.
 */
export async function processDocument(_job: ProcessDocumentJob): Promise<void> {
  throw new Error("SCAFFOLD: implement in BE-S3-01");
}
