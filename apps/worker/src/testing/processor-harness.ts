import {
  inMemoryBlobStore,
  inMemoryCatalogRepository,
  inMemoryProcessingRepository,
  type StoredDocument,
} from "@archiva/catalog";
import { AlwaysCleanScanner, type PipelineStage, type ProcessingRun } from "@archiva/enrichment";
import {
  asTenantId,
  asUserId,
  type DocumentId,
  ok,
  type TenantId,
  type VersionId,
} from "@archiva/shared";
import { createDocumentProcessor, type DocumentProcessorDeps } from "../jobs/document-processor.ts";

type ProcessorHarness = {
  doc: StoredDocument;
  tenantId: TenantId;
  documentId: DocumentId;
  versionId: VersionId;
  calls: string[];
  deps: Omit<DocumentProcessorDeps, "catalogRepo"> & {
    catalogRepo: ReturnType<typeof inMemoryCatalogRepository>;
  };
  readonly process: ReturnType<typeof createDocumentProcessor>;
};

export async function processorHarness(): Promise<ProcessorHarness> {
  const tenantId = asTenantId(crypto.randomUUID());
  const catalogRepo = inMemoryCatalogRepository();
  const blobStore = inMemoryBlobStore();
  const blobKey = `isolated/${crypto.randomUUID()}`;
  await blobStore.put(blobKey, new Blob(["test"]).stream());
  const inserted = await catalogRepo.insertDocumentWithVersion(tenantId, {
    uploaderId: asUserId(crypto.randomUUID()),
    filename: "test.pdf",
    contentHash: crypto.randomUUID(),
    mimeType: "application/pdf",
    sizeBytes: 4,
    blobKey,
  });
  if (!inserted.ok) throw new Error("Fixture insert failed");
  const doc = catalogRepo.documents[0];
  if (!doc?.currentVersionId) throw new Error("Fixture version missing");
  const calls: string[] = [];
  const stage =
    (name: string): PipelineStage =>
    async () => {
      calls.push(name);
      return ok(undefined);
    };
  const stages = { extract: stage("extract"), classify: stage("classify"), index: stage("index") };
  const processing = inMemoryProcessingRepository(catalogRepo.documents);
  const deps = {
    catalogRepo,
    blobStore,
    processing,
    stages,
    scanner: new AlwaysCleanScanner(),
    quota: {
      async revertCommittedDocumentQuota() {
        calls.push("quota");
      },
    },
    audit: {
      async record() {
        calls.push("audit");
      },
    },
    derivedData: {
      async removeIfCurrent(run: ProcessingRun) {
        if (catalogRepo.documents[0]?.currentVersionId !== run.versionId) return false;
        calls.push("cleanup");
        return true;
      },
    },
  };
  return {
    doc,
    tenantId,
    documentId: doc.id,
    versionId: doc.currentVersionId,
    calls,
    deps,
    get process() {
      return createDocumentProcessor(deps);
    },
  };
}
