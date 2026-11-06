import type { JobQueue } from "@archiva/catalog";
import {
  DOCUMENT_QUEUE,
  documentJobOptions,
  PROCESS_DOCUMENT_JOB,
  valkeyConnection,
} from "@archiva/enrichment";
import { Queue } from "bullmq";

export function createDocumentJobQueue(
  url: string,
  options: { prefix?: string; reportError(error: Error): void },
): JobQueue & { close(): Promise<void> } {
  const queue = new Queue(DOCUMENT_QUEUE, {
    connection: {
      ...valkeyConnection(url),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
    },
    prefix: options.prefix,
  });
  queue.on("error", options.reportError);
  return {
    async enqueue(documentId) {
      await queue.waitUntilReady();
      await queue.add(
        PROCESS_DOCUMENT_JOB,
        { documentId },
        {
          ...documentJobOptions(documentId),
          deduplication: { id: documentId, replace: true, keepLastIfActive: true },
        },
      );
    },
    close: () => queue.close(),
  };
}
