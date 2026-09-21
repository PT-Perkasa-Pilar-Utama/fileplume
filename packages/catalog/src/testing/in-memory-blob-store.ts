import type { BlobStore } from "../ports.ts";

/**
 * Ships with the module so catalog is importable in a test with no network,
 * no container and no environment variables.
 * technical-specs/03-repository-structure.md 3.3.
 */
export function inMemoryBlobStore(): BlobStore & { keys(): string[] } {
  const blobs = new Map<string, ArrayBuffer>();

  return {
    keys: () => [...blobs.keys()],

    async put(key, stream) {
      const buffer = await new Response(stream).arrayBuffer();
      blobs.set(key, buffer);
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const sha256 = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return { sizeBytes: buffer.byteLength, sha256 };
    },

    async get(key) {
      const buffer = blobs.get(key);
      if (!buffer) throw new Error(`no blob at ${key}`);
      // Allowlisted cast: a Response built from a buffer always carries a body.
      return new Response(buffer).body as ReadableStream;
    },

    async delete(key) {
      blobs.delete(key);
    },
  };
}
