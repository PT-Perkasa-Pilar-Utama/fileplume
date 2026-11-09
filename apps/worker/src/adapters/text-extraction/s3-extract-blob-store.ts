import type { ExtractBlobStore } from "@archiva/enrichment";

/** The S3 surface the extract stage needs, so the test can supply one. */
export type ExtractBlobReader = {
  file(key: string): { stream(): ReadableStream };
};

/**
 * The extract stage reads the version's immutable blob by its stored key.
 * technical-specs/06-data-model.md 6.8: the key is allocated by the upload path.
 */
export function createS3ExtractBlobStore(s3: ExtractBlobReader): ExtractBlobStore {
  return {
    async get(key: string): Promise<ReadableStream> {
      return s3.file(key).stream();
    },
  };
}
