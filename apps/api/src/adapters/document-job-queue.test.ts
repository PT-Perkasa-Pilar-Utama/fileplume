import { afterAll, beforeAll, expect, test } from "bun:test";
import { DOCUMENT_QUEUE, PROCESSING_ATTEMPTS, valkeyConnection } from "@archiva/enrichment";
import { asDocumentId } from "@archiva/shared";
import { Queue } from "bullmq";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { createDocumentJobQueue } from "./document-job-queue.ts";

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

test("API enqueue deduplicates payload-only jobs with the pipeline retry policy", async () => {
  const prefix = `test-${crypto.randomUUID()}`;
  const errors: Error[] = [];
  const adapter = createDocumentJobQueue(url, {
    prefix,
    reportError: (error) => errors.push(error),
  });
  const queue = new Queue(DOCUMENT_QUEUE, { prefix, connection: valkeyConnection(url) });
  const documentId = asDocumentId(crypto.randomUUID());
  try {
    await adapter.enqueue(documentId);
    await adapter.enqueue(documentId);
    expect(await queue.getWaitingCount()).toBe(1);
    const job = await queue.getJob(documentId);
    expect(job?.data).toEqual({ documentId });
    expect(job?.opts.attempts).toBe(PROCESSING_ATTEMPTS);
    expect(job?.opts.backoff).toEqual({ type: "exponential", delay: 5000 });
    expect(job?.opts.removeOnFail).toBe(false);
    await job?.moveToCompleted("done", "0", false);
    await adapter.enqueue(documentId);
    const retried = await queue.getJob(documentId);
    expect(await retried?.getState()).toBe("waiting");
    expect(errors).toEqual([]);
  } finally {
    await adapter.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
