import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { BlobStore } from "@archiva/catalog";
import type { S3Client } from "bun";
import { startTestBlobStore } from "../testing/test-blob-store.ts";
import { createS3BlobStore } from "./s3-blob-store.ts";

// Larger than one multipart part, so the writer's multipart path is exercised.
const MULTIPART_BYTES = 12 * 1024 * 1024;

function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array> {
  return new Blob([bytes]).stream();
}

describe("createS3BlobStore", () => {
  let s3: S3Client;
  let store: BlobStore;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const started = await startTestBlobStore();
    s3 = started.s3;
    stop = started.stop;
    store = createS3BlobStore(s3);
  }, 120_000);

  afterAll(async () => {
    await stop();
  });

  test("put reports the size and SHA-256 of the bytes it stored", async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(1024));
    const expected = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

    const result = await store.put("t/a/d/put/v/1", streamOf(bytes));

    expect(result).toEqual({ sizeBytes: 1024, sha256: expected });
  });

  test("get streams back exactly what put stored, across multipart", async () => {
    const bytes = new Uint8Array(MULTIPART_BYTES).fill(7);
    await store.put("t/a/d/get/v/1", streamOf(bytes));

    const body = await new Response(await store.get("t/a/d/get/v/1")).bytes();

    expect(body.byteLength).toBe(MULTIPART_BYTES);
    expect(body).toEqual(bytes);
  });

  test("delete removes the object", async () => {
    await store.put("t/a/d/delete/v/1", streamOf(new Uint8Array([1, 2, 3])));

    await store.delete("t/a/d/delete/v/1");

    expect(await s3.file("t/a/d/delete/v/1").exists()).toBe(false);
  });
});
