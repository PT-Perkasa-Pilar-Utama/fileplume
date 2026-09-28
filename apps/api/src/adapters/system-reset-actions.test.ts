import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { S3Client } from "bun";
import { BASE_CONFIG } from "../testing/test-app.ts";
import { startTestBlobStore } from "../testing/test-blob-store.ts";
import { createSystemResetActions } from "./system-reset-actions.ts";

describe("createSystemResetActions purgeBlobs", () => {
  let s3: S3Client;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const started = await startTestBlobStore();
    s3 = started.s3;
    stop = started.stop;
  }, 120_000);

  afterAll(async () => {
    await stop();
  });

  test("deletes every tenant blob and leaves keys outside t/ alone", async () => {
    await s3.write("t/one/d/1/v/1", "a");
    await s3.write("t/two/d/2/v/1", "b");
    await s3.write("outside/keep", "c");

    await createSystemResetActions({ config: BASE_CONFIG, s3Client: s3 }).purgeBlobs();

    const remaining = await s3.list();
    expect(remaining.contents?.map((item) => item.key)).toEqual(["outside/keep"]);
  });
});
