import type { JobQueue } from "@archiva/catalog";
import type { DocumentId } from "@archiva/shared";

export const nullJobQueue: JobQueue = {
  async enqueue(_documentId: DocumentId): Promise<void> {},
};
