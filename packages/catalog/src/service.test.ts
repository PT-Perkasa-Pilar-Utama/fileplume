import { describe, expect, test } from "bun:test";
import {
  assertBlobKeyPrefix,
  belongsToTenant,
  blobKey,
  InvalidBlobKeyPrefixError,
} from "./internal/blob-key.ts";
import { ACCEPTED_MIME, isAcceptedType, MAX_BATCH, MAX_BULK_DOWNLOAD } from "./service.ts";
import { inMemoryBlobStore } from "./testing/in-memory-blob-store.ts";

describe("accepted types", () => {
  test("accepts the four documented formats", () => {
    // AC-01.03 names PDF, DOCX, XLSX and TXT.
    expect(ACCEPTED_MIME).toHaveLength(4);
    expect(isAcceptedType("application/pdf")).toBe(true);
    expect(isAcceptedType("text/plain")).toBe(true);
  });

  test("rejects an image", () => {
    expect(isAcceptedType("image/jpeg")).toBe(false);
  });
});

describe("limits", () => {
  test("batch cap is 20 and bulk download cap is 50", () => {
    // AC-01.05 and AC-11.03.
    expect(MAX_BATCH).toBe(20);
    expect(MAX_BULK_DOWNLOAD).toBe(50);
  });
});

describe("blob keys", () => {
  test("are built from ids, never from the filename", () => {
    // technical-specs/07-security.md 7.5, path traversal.
    const key = blobKey("t1", "d1", "v1");
    expect(key).toBe("t/t1/d/d1/v/v1");
    expect(key).not.toContain("..");
  });

  test("carry a tenant prefix the adapter can refuse on", () => {
    expect(belongsToTenant(blobKey("t1", "d1", "v1"), "t1")).toBe(true);
    expect(belongsToTenant(blobKey("t1", "d1", "v1"), "t2")).toBe(false);
  });

  test("assertBlobKeyPrefix accepts a key matching the tenant", () => {
    expect(() => assertBlobKeyPrefix(blobKey("tenant-1", "doc-1", "v1"), "tenant-1")).not.toThrow();
  });

  test("assertBlobKeyPrefix throws InvalidBlobKeyPrefixError for a foreign tenant key", () => {
    // technical-specs/07-security.md 7.3: S3 adapter refuses a key whose prefix does not match active tenant.
    expect(() => assertBlobKeyPrefix(blobKey("tenant-1", "doc-1", "v1"), "tenant-2")).toThrow(
      InvalidBlobKeyPrefixError,
    );
  });

  test("assertBlobKeyPrefix throws InvalidBlobKeyPrefixError for a malformed key", () => {
    expect(() => assertBlobKeyPrefix("invalid-key", "tenant-1")).toThrow(InvalidBlobKeyPrefixError);
  });
});

describe("in-memory blob store", () => {
  test("round-trips content and reports a stable hash", async () => {
    const store = inMemoryBlobStore();
    const body = () => new Response("halo dunia").body as ReadableStream;
    const first = await store.put("t/t1/d/d1/v/v1", body());
    const second = await store.put("t/t1/d/d1/v/v2", body());
    expect(first.sha256).toBe(second.sha256);
    expect(first.sizeBytes).toBe(10);
    expect(store.keys()).toHaveLength(2);
  });
});
