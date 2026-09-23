import type { JobQueue } from "@archiva/catalog";
import type { DocumentId } from "@archiva/shared";

export const nullJobQueue: JobQueue = {
  async enqueue(_documentId: DocumentId): Promise<void> {
    // SCAFFOLD: real BullMQ enqueue lands in BE-S3-01. Until then uploads rest
    // in queued and the worker card owns the backlog.
  },
};
