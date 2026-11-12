import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  createCatalogService,
  inMemoryBlobStore,
  inMemoryCatalogRepository,
  inMemoryProcessingRepository,
} from "@archiva/catalog";
import { DOCUMENT_QUEUE, valkeyConnection } from "@archiva/enrichment";
import { asTenantId, asUserId, ok } from "@archiva/shared";
import { Queue } from "bullmq";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { createDocumentConsumer } from "./consumer.ts";

let container: StartedTestContainer | undefined;
let url: string;
beforeAll(async () => {
  container = await new GenericContainer("valkey/valkey:8.1")
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();
  url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
}, 120_000);
afterAll(async () => {
  await container?.stop();
});

function fixture() {
  const tenantId = asTenantId(crypto.randomUUID());
  const uploaderId = asUserId(crypto.randomUUID());
  const repository = inMemoryCatalogRepository();
  const events: string[] = [];
  const service = createCatalogService({
    repository,
    blobStore: inMemoryBlobStore(),
    clock: { now: () => new Date() },
    quota: {
      async getMaxFileSizeMb() {
        return 20;
      },
      async reserveQuota(id, bytes) {
        return ok({ id: crypto.randomUUID(), tenantId: id, bytes });
      },
      async commitQuota() {},
      async releaseQuota() {},
      async revertCommit() {},
    },
    queue: {
      async enqueue() {
        throw new Error("queue unavailable");
      },
    },
    audit: {
      async record(event) {
        events.push(event.action);
      },
    },
    session: {
      async validateSession() {
        return true;
      },
    },
  });
  return { tenantId, uploaderId, repository, events, service };
}

function pdf(content: string) {
  const bytes = new TextEncoder().encode(`%PDF-1.4\n${content}`);
  return { stream: new Blob([bytes]).stream(), sizeBytes: bytes.byteLength };
}

async function until(predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error("Queue recovery timed out");
    await Bun.sleep(25);
  }
}

test("startup sweep enqueues committed upload after enqueue failure", async () => {
  const h = fixture();
  const result = await h.service.uploadBatch(h.tenantId, h.uploaderId, [
    { filename: "upload.pdf", ...pdf("upload") },
  ]);
  if (!result.ok || result.value.results[0]?.status !== "accepted")
    throw new Error("Upload failed");
  const id = result.value.results[0].document.id;
  expect(h.events).toEqual(["document.upload"]);
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  const consumer = createDocumentConsumer({
    url,
    prefix,
    concurrency: 1,
    processing: inMemoryProcessingRepository(h.repository.documents),
    process: async () => "noop",
    reportError: (error) => errors.push(error),
  });
  try {
    await until(async () => Boolean(await queue.getJob(id)));
    expect(errors).toEqual([]);
  } finally {
    await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);

test("periodic sweep enqueues committed new version after enqueue failure", async () => {
  const h = fixture();
  const initial = await h.service.upload({
    tenantId: h.tenantId,
    uploaderId: h.uploaderId,
    filename: "initial.pdf",
    ...pdf("initial"),
  });
  if (!initial.ok) throw new Error("Upload failed");
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  // Remove the initial queued state from the sweep until the new version is committed.
  const doc = h.repository.documents[0];
  if (!doc) throw new Error("Missing document");
  doc.processingState = "ready";
  const processing = inMemoryProcessingRepository(h.repository.documents);
  let initialSweepFinished: () => void = () => {};
  const initialSweep = new Promise<void>((resolve) => {
    initialSweepFinished = resolve;
  });
  const consumer = createDocumentConsumer({
    url,
    prefix,
    concurrency: 1,
    processing: {
      ...processing,
      async listRecoverableDocuments(limit, after) {
        const rows = await processing.listRecoverableDocuments(limit, after);
        initialSweepFinished();
        return rows;
      },
    },
    process: async () => "noop",
    reportError: (error) => errors.push(error),
  });
  try {
    await initialSweep;
    const version = await h.service.addVersion(
      initial.value.id,
      {
        tenantId: h.tenantId,
        uploaderId: h.uploaderId,
        filename: "version.pdf",
        ...pdf("version"),
      },
      { userId: h.uploaderId, role: "member" },
      7,
    );
    expect(version.ok).toBe(true);
    expect(h.events).toEqual(["document.upload", "document.version_add"]);
    expect(h.repository.documents[0]?.processingState).toBe("queued");
    await until(async () => Boolean(await queue.getJob(initial.value.id)));
    expect(errors).toEqual([]);
  } finally {
    await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);
