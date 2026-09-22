import type { BlobStore } from "@archiva/catalog";
import { S3Client } from "bun";

export type S3BlobStoreConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export function createS3BlobStore(options: S3BlobStoreConfig): BlobStore {
  const s3 = new S3Client(options);

  return {
    async put(key: string, stream: ReadableStream): Promise<{ sizeBytes: number; sha256: string }> {
      // 5.2 step 3d: the digest is computed as the bytes pass, not afterwards.
      const hasher = new Bun.CryptoHasher("sha256");
      const writer = s3.file(key).writer();
      let sizeBytes = 0;
      const reader = (stream as ReadableStream<Uint8Array>).getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;
          hasher.update(value);
          writer.write(value);
          sizeBytes += value.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
      await writer.end();
      return { sizeBytes, sha256: hasher.digest("hex") };
    },

    async get(key: string): Promise<ReadableStream> {
      const file = s3.file(key);
      return file.stream();
    },

    async delete(key: string): Promise<void> {
      const file = s3.file(key);
      await file.delete();
    },
  };
}
