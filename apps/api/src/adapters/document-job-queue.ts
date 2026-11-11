import type { JobQueue } from "@archiva/catalog";
import {
  DOCUMENT_QUEUE,
  documentJobOptions,
  PROCESS_DOCUMENT_JOB,
  requeueFinishedJob,
  valkeyConnection,
} from "@archiva/enrichment";
import { Queue } from "bullmq";

const PRODUCER_MAX_RETRIES_PER_REQUEST = 1;
const PRODUCER_CONNECT_TIMEOUT_MS = 5000;

export function createDocumentJobQueue(
  url: string,
  options: { prefix?: string; reportError(error: Error): void },
): JobQueue & { close(): Promise<void> } {
  const queue = new Queue(DOCUMENT_QUEUE, {
    connection: {
      ...valkeyConnection(url),
      maxRetriesPerRequest: PRODUCER_MAX_RETRIES_PER_REQUEST,
      enableOfflineQueue: false,
      connectTimeout: PRODUCER_CONNECT_TIMEOUT_MS,
    },
    prefix: options.prefix,
  });
  queue.on("error", options.reportError);
  return {
    async enqueue(documentId) {
      await queue.waitUntilReady();
      const existing = await queue.getJob(documentId);
      if (existing) {
        await requeueFinishedJob(existing);
        return;
      }
      await queue.add(PROCESS_DOCUMENT_JOB, { documentId }, documentJobOptions(documentId));
    },
    close: () => queue.close(),
  };
}
