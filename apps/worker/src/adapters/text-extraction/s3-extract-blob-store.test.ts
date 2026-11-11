import { describe, expect, test } from "bun:test";
import type { ExtractBlobReader } from "./s3-extract-blob-store.ts";
import { createS3ExtractBlobStore } from "./s3-extract-blob-store.ts";

describe("createS3ExtractBlobStore", () => {
  test("reads the stream for the requested blob key", async () => {
    const keys: string[] = [];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const s3: ExtractBlobReader = {
      file(key: string) {
        keys.push(key);
        return { stream: () => stream };
      },
    };
    const blobStore = createS3ExtractBlobStore(s3);

    expect(await blobStore.get("t/tenant/d/doc/v/version")).toBe(stream);
    expect(keys).toEqual(["t/tenant/d/doc/v/version"]);
  });
});
