import {
  inMemoryBlobStore,
  inMemoryCatalogRepository,
  inMemoryProcessingRepository,
} from "@archiva/catalog";
import { AlwaysCleanScanner, type PipelineStage } from "@archiva/enrichment";
import { asTenantId, asUserId, ok } from "@archiva/shared";
import { createDocumentProcessor } from "../jobs/document-processor.ts";

export async function processorHarness() {
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
      async remove() {
        calls.push("cleanup");
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
