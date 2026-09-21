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
      const buffer = await new Response(stream).arrayBuffer();
      const file = s3.file(key);
      await file.write(buffer);

      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const sha256 = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return { sizeBytes: buffer.byteLength, sha256 };
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
