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
      // Mirrors the S3 adapter: digest computed as bytes pass, not afterwards.
      const hasher = new Bun.CryptoHasher("sha256");
      const chunks: Uint8Array[] = [];
      let sizeBytes = 0;
      const reader = (stream as ReadableStream<Uint8Array>).getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;
          hasher.update(value);
          chunks.push(value.slice());
          sizeBytes += value.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
      const combined = new Uint8Array(sizeBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      blobs.set(key, combined.buffer as ArrayBuffer);
      return { sizeBytes, sha256: hasher.digest("hex") };
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
