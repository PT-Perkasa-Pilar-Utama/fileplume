import type { ProcessingRepository } from "@archiva/catalog";
import {
  DOCUMENT_QUEUE,
  documentJobOptions,
  PROCESS_DOCUMENT_JOB,
  PROCESSING_ATTEMPTS,
  requeueFinishedJob,
  valkeyConnection,
} from "@archiva/enrichment";
import type { DocumentId } from "@archiva/shared";
import { asDocumentId, type asTenantId, asVersionId, idParams } from "@archiva/shared";
import { Queue, UnrecoverableError, Worker } from "bullmq";
import type { DocumentAttempt, DocumentOutcome } from "./jobs/document-processor.ts";

type Processor = (
  id: ReturnType<typeof asDocumentId>,
  attempt: DocumentAttempt,
) => Promise<DocumentOutcome>;
const RECOVERY_BATCH_SIZE = 20;
const RECOVERY_INTERVAL_MS = 5000;

export function createDocumentConsumer(deps: {
  url: string;
  concurrency: number;
  prefix?: string;
  processing: ProcessingRepository;
  process: Processor;
  reportError(error: Error): void;
}): { recover(): Promise<void>; close(): Promise<void> } {
  const connection = valkeyConnection(deps.url);
  const prefix = deps.prefix;
  const queue = new Queue(DOCUMENT_QUEUE, { connection, prefix });
  const worker = new Worker(
    DOCUMENT_QUEUE,
    async (job) => {
      const parsed = idParams.safeParse({ id: job.data?.documentId });
      if (!parsed.success) throw new UnrecoverableError("Invalid document processing job");
      // A terminal retry resets attemptsMade, so stale progress from the previous
      // run is ignored rather than cleared. Clearing it first would race a worker
      // that picks the requeued job up between the two commands.
      const progress = job.attemptsMade > 0 ? job.progress : undefined;
      const version =
        typeof progress === "object" && "claimedVersionId" in progress
          ? idParams.safeParse({ id: progress.claimedVersionId })
          : undefined;
      const outcome = await deps.process(asDocumentId(parsed.data.id), {
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? PROCESSING_ATTEMPTS,
        ...(version?.success ? { expectedVersionId: asVersionId(version.data.id) } : {}),
        async claimVersion(versionId) {
          await job.updateProgress({ claimedVersionId: versionId });
        },
      });
      if (outcome === "retry") throw new Error("Transient document processing failure");
      if (outcome === "failed") throw new UnrecoverableError("Document processing failed");
    },
    { connection, prefix, concurrency: deps.concurrency },
  );
  worker.on("error", deps.reportError);
  queue.on("error", deps.reportError);
  async function enqueueRecoverableDocument(documentId: DocumentId): Promise<void> {
    const job = await queue.getJob(documentId);
    if (job) {
      await requeueFinishedJob(job);
      return;
    }
    await queue.add(PROCESS_DOCUMENT_JOB, { documentId }, documentJobOptions(documentId));
  }

  let recovering = false;
  let cursor:
    | { tenantId: ReturnType<typeof asTenantId>; documentId: ReturnType<typeof asDocumentId> }
    | undefined;
  async function recover(): Promise<void> {
    if (recovering) return;
    recovering = true;
    try {
      const documents = await deps.processing.listRecoverableDocuments(RECOVERY_BATCH_SIZE, cursor);
      for (const { documentId } of documents) {
        try {
          await enqueueRecoverableDocument(documentId);
        } catch (error: unknown) {
          deps.reportError(error instanceof Error ? error : new Error("Queue recovery failed"));
        }
      }
      cursor = documents.length === RECOVERY_BATCH_SIZE ? documents.at(-1) : undefined;
    } finally {
      recovering = false;
    }
  }
  const reportRecoveryError = (error: unknown): void =>
    deps.reportError(error instanceof Error ? error : new Error("Queue recovery failed"));
  void recover().catch(reportRecoveryError);
  const timer = setInterval(() => {
    void recover().catch(reportRecoveryError);
  }, RECOVERY_INTERVAL_MS);
  return {
    recover,
    async close() {
      clearInterval(timer);
      await worker.close();
      await queue.close();
    },
  };
}
