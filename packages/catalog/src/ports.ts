export interface BlobStore {
  put(key: string, stream: ReadableStream): Promise<{ sizeBytes: number; sha256: string }>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
}

export interface DocumentConverter {
  toPdf(source: ReadableStream, mimeType: string): Promise<ReadableStream>;
}

export interface Clock {
  now(): Date;
}
