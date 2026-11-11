import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  DOCUMENT_QUEUE,
  documentJobOptions,
  PROCESS_DOCUMENT_JOB,
  valkeyConnection,
} from "@archiva/enrichment";
import { asDocumentId, type asTenantId, err } from "@archiva/shared";
import { Queue } from "bullmq";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { createDocumentConsumer } from "./consumer.ts";
import { createDocumentWorker } from "./document-worker.ts";
import { processorHarness } from "./testing/processor-harness.ts";

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

async function until(predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error("Queue assertion timed out");
    await Bun.sleep(25);
  }
}

test("AC-44.02: real BullMQ retries with increasing delays while preserving processing", async () => {
  const h = await processorHarness();
  const times: number[] = [];
  h.deps.stages.classify = async () => {
    times.push(Date.now());
    expect(h.doc.processingState).toBe("processing");
    return err({ reason: "ai_unavailable", retryable: true });
  };
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const consumer = createDocumentWorker({
    ...h.deps,
    url,
    prefix,
    concurrency: 1,
    reportError: (error) => errors.push(error),
  });
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  try {
    const job = await queue.add(
      PROCESS_DOCUMENT_JOB,
      { documentId: h.documentId },
      documentJobOptions(h.documentId),
    );
    await until(async () => (await job.getState()) === "failed");
    expect(times).toHaveLength(3);
    const [first, second, third] = times;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error("Missing attempts");
    expect(second - first).toBeGreaterThanOrEqual(5000);
    expect(third - second).toBeGreaterThanOrEqual(10000);
    expect(h.doc.processingState).toBe("failed");
    expect(h.doc.failureReason).toBe("ai_unavailable");
    expect(errors).toEqual([]);
  } finally {
    await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);

test("consumer startup immediately enqueues queued documents without jobs", async () => {
  const h = await processorHarness();
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  const consumer = createDocumentConsumer({
    url,
    prefix,
    concurrency: 1,
    processing: h.deps.processing,
    process: async () => "noop",
    reportError: (error) => errors.push(error),
  });
  try {
    await until(async () => Boolean(await queue.getJob(h.documentId)));
    expect(errors).toEqual([]);
  } finally {
    await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);

test("recovery advances beyond a full batch of existing delayed jobs", async () => {
  const h = await processorHarness();
  const prefix = `test-${crypto.randomUUID()}`;
  const ids = Array.from({ length: 21 }, (_, i) =>
    asDocumentId(`00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`),
  );
  const processing = {
    ...h.deps.processing,
    async listRecoverableDocuments(
      limit: number,
      after?: {
        tenantId: ReturnType<typeof asTenantId>;
        documentId: ReturnType<typeof asDocumentId>;
      },
    ) {
      return ids
        .filter((id) => !after || id > after.documentId)
        .slice(0, limit)
        .map((documentId) => ({
          tenantId: h.tenantId,
          documentId,
        }));
    },
  };
  const errors: Error[] = [];
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  const consumer = createDocumentConsumer({
    url,
    prefix,
    concurrency: 1,
    processing,
    process: async () => "noop",
    reportError: (error) => errors.push(error),
  });
  try {
    for (const id of ids.slice(0, 20)) {
      await queue.add(
        PROCESS_DOCUMENT_JOB,
        { documentId: id },
        { ...documentJobOptions(id), delay: 60000 },
      );
    }
    await consumer.recover();
    await consumer.recover();
    const last = ids.at(-1);
    if (!last) throw new Error("Missing fixture");
    await until(async () => Boolean(await queue.getJob(last)));
    expect(errors).toEqual([]);
  } finally {
    await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);

test("concurrent consumers recover the same queued document without losing it", async () => {
  const h = await processorHarness();
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const options = {
    url,
    prefix,
    concurrency: 1,
    processing: h.deps.processing,
    process: h.process,
    reportError: (error: Error) => errors.push(error),
  };
  const first = createDocumentConsumer(options);
  const second = createDocumentConsumer(options);
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  try {
    await Promise.all([first.recover(), second.recover()]);
    await until(async () => h.doc.processingState === "ready");
    expect(h.calls.filter((call) => call === "index")).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await first.close();
    await second.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);

test("recovery replaces a retained completed job when a newer version is queued", async () => {
  const h = await processorHarness();
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const consumer = createDocumentConsumer({
    url,
    prefix,
    concurrency: 1,
    processing: h.deps.processing,
    process: h.process,
    reportError: (error) => errors.push(error),
  });
  const queue = new Queue(DOCUMENT_QUEUE, { connection: valkeyConnection(url), prefix });
  try {
    await consumer.recover();
    await until(async () => h.doc.processingState === "ready");
    await until(async () => (await (await queue.getJob(h.documentId))?.getState()) === "completed");
    h.doc.processingState = "queued";
    await Promise.all([consumer.recover(), consumer.recover()]);
    await until(async () => h.doc.processingState === "ready");
    expect(h.calls.filter((call) => call === "index")).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    await consumer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
}, 40_000);
