import type { CatalogRepository, ProcessingRepository } from "@archiva/catalog";
import type { DerivedDataPort, PipelineDeps } from "@archiva/enrichment";
import { createPipeline } from "@archiva/enrichment";
import type { DocumentId, VersionId } from "@archiva/shared";
import { createProcessDocumentHandler, type ProcessDocumentDeps } from "./process-document.ts";

export type DocumentProcessorDeps = ProcessDocumentDeps & {
  catalogRepo: CatalogRepository;
  processing: ProcessingRepository;
  stages: Omit<PipelineDeps, "state" | "derivedData">;
  derivedData: DerivedDataPort;
};
export type DocumentAttempt = {
  attempt: number;
  maxAttempts: number;
  expectedVersionId?: VersionId;
  claimVersion?(versionId: VersionId): Promise<void>;
};
export type DocumentOutcome = "ready" | "failed" | "retry" | "noop" | "infected";

class ScanUnavailable extends Error {}

/** docs/technical-specs/12-document-processing-pipeline.md §§12.1–12.4. */
export function createDocumentProcessor(
  deps: DocumentProcessorDeps,
): (documentId: DocumentId, attempt: DocumentAttempt) => Promise<DocumentOutcome> {
  const scan = createProcessDocumentHandler({
    ...deps,
    catalogRepo: {
      ...deps.catalogRepo,
      async findTenantByDocumentId(id) {
        try {
          return await deps.catalogRepo.findTenantByDocumentId(id);
        } catch (error: unknown) {
          throw new ScanUnavailable("Scan lookup unavailable", { cause: error });
        }
      },
      async findDocumentForProcessing(tenantId, id) {
        try {
          return await deps.catalogRepo.findDocumentForProcessing(tenantId, id);
        } catch (error: unknown) {
          throw new ScanUnavailable("Scan document unavailable", { cause: error });
        }
      },
    },
    scanner: {
      async scan(stream) {
        try {
          return await deps.scanner.scan(stream);
        } catch (error: unknown) {
          throw new ScanUnavailable("Scan unavailable", { cause: error });
        }
      },
    },
    blobStore: {
      ...deps.blobStore,
      async get(key) {
        try {
          return await deps.blobStore.get(key);
        } catch (error: unknown) {
          throw new ScanUnavailable("Scan input unavailable", { cause: error });
        }
      },
    },
  });
  const pipeline = createPipeline({
    ...deps.stages,
    state: deps.processing,
    derivedData: deps.derivedData,
  });
  return async (documentId, { attempt, maxAttempts, expectedVersionId, claimVersion }) => {
    const tenantId = await deps.catalogRepo.findTenantByDocumentId(documentId);
    if (!tenantId) return "noop";
    const doc = await deps.catalogRepo.findDocumentForProcessing(tenantId, documentId);
    if (!doc || doc.processingState === "ready" || doc.processingState === "failed") return "noop";
    const versionId = doc.currentVersionId;
    if (expectedVersionId && expectedVersionId !== versionId) return "noop";
    await claimVersion?.(versionId);
    if (
      doc.processingState === "queued" &&
      !(await deps.processing.claimVersion(tenantId, documentId, versionId))
    )
      return "noop";
    const run = { tenantId, documentId, versionId };
    if (!(await deps.processing.isCurrentRun(tenantId, documentId, versionId))) return "noop";
    try {
      const result = await scan({ documentId }, doc);
      if (result === "infected") return "infected";
      if (result === "noop") return "noop";
    } catch (error: unknown) {
      if (!(error instanceof ScanUnavailable)) throw error;
      if (attempt < maxAttempts) return "retry";
      const finished = await deps.processing.finishVersion(tenantId, documentId, versionId, {
        state: "failed",
        reason: null,
      });
      return finished ? "failed" : "noop";
    }
    const outcome = await pipeline(run, attempt, maxAttempts);
    return outcome === "stale" ? "noop" : outcome;
  };
}
