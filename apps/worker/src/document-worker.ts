import { createDocumentConsumer } from "./consumer.ts";
import type { DocumentProcessorDeps } from "./jobs/document-processor.ts";
import { createDocumentProcessor } from "./jobs/document-processor.ts";

export type DocumentWorkerDeps = DocumentProcessorDeps & {
  url: string;
  concurrency: number;
  prefix?: string;
  reportError(error: Error): void;
};

/** Compose BullMQ delivery with scan-first document processing and injected pipeline stages. */
export function createDocumentWorker(deps: DocumentWorkerDeps): {
  recover(): Promise<void>;
  close(): Promise<void>;
} {
  return createDocumentConsumer({
    url: deps.url,
    concurrency: deps.concurrency,
    ...(deps.prefix === undefined ? {} : { prefix: deps.prefix }),
    processing: deps.processing,
    process: createDocumentProcessor(deps),
    reportError: deps.reportError,
  });
}
