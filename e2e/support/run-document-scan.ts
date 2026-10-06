import { createActivityService, createDrizzleActivityRepository } from "@archiva/activity";
import { createDrizzleCatalogRepository } from "@archiva/catalog";
import { loadConfig } from "@archiva/config";
import { createDb } from "@archiva/db";
import { AlwaysCleanScanner, AlwaysInfectedScanner } from "@archiva/enrichment";
import { asDocumentId } from "@archiva/shared";
import { createDrizzleTenancyRepository, createTenancyService } from "@archiva/tenancy";
import { createS3BlobStore } from "../../apps/api/src/adapters/s3-blob-store.ts";
import { createS3Client } from "../../apps/api/src/adapters/s3-client.ts";
import { createProcessDocumentHandler } from "../../apps/worker/src/jobs/process-document.ts";

const [documentId, outcome] = process.argv.slice(2);

if (!documentId || (outcome !== "clean" && outcome !== "infected")) {
  throw new Error("Usage: bun run e2e/support/run-document-scan.ts <document-id> <clean|infected>");
}

const config = loadConfig();
const dbHandle = createDb({ url: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });
const clock = { now: (): Date => new Date() };
const catalogRepo = createDrizzleCatalogRepository(dbHandle.db);
const tenancy = createTenancyService({
  repository: createDrizzleTenancyRepository(dbHandle.db),
  clock,
});
const activity = createActivityService({
  repository: createDrizzleActivityRepository(dbHandle.db),
  clock,
});
const processor = createProcessDocumentHandler({
  catalogRepo,
  blobStore: createS3BlobStore(createS3Client(config)),
  quota: tenancy,
  audit: activity,
  scanner: outcome === "clean" ? new AlwaysCleanScanner() : new AlwaysInfectedScanner(),
});

try {
  const result = await processor({ documentId: asDocumentId(documentId) });
  if (result !== outcome) {
    throw new Error(`Expected document processing outcome ${outcome}, received ${result}`);
  }
} finally {
  await dbHandle.client.close();
}
