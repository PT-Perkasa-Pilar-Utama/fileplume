export interface MalwareScanner {
  scan(stream: ReadableStream): Promise<{ infected: boolean; signature?: string }>;
}

export interface TextExtractor {
  extract(
    stream: ReadableStream,
    mimeType: string,
  ): Promise<{ pages: string[]; method: "native" | "ocr" | "mixed"; language?: string }>;
}

export interface AiProvider {
  classify(text: string, categories: string[]): Promise<{ category: string; confidence: number }>;
  tag(text: string): Promise<{ tag: string; confidence: number }[]>;
}

export interface JobQueue {
  enqueue(name: string, payload: unknown, jobId: string): Promise<void>;
}
