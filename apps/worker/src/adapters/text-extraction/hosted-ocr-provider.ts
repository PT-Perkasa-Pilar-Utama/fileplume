import type { OcrProvider } from "@archiva/enrichment";
import { ProcessTimeoutError } from "./process-runner.ts";

/** technical-specs/10-integration-points.md 10.8 rule 1: OCR is bounded at 180 s per page. */
export const OCR_TIMEOUT_MS = 180_000;

/**
 * The wire call for one page. The hosted vendor's request and response shape is
 * an open commercial question (docs/technical-specs/01-overview.md 1.7 item 4),
 * so the transport is injected by the composition root rather than guessed here.
 */
export type RecognizeImage = (request: {
  image: Uint8Array;
  languages: readonly ["ind", "eng"];
  apiKey: string;
  signal: AbortSignal;
}) => Promise<{ text: string; confidence: number }>;

export type HostedOcrConfig = {
  apiKey: string;
  recognizeImage: RecognizeImage;
  timeoutMs?: number;
};

/** Hosted document AI. technical-specs/10-integration-points.md 10.7. */
export class HostedOcrProvider implements OcrProvider {
  private readonly timeoutMs: number;

  constructor(private readonly config: HostedOcrConfig) {
    this.timeoutMs = config.timeoutMs ?? OCR_TIMEOUT_MS;
  }

  async recognize(
    image: Uint8Array,
    languages: readonly ["ind", "eng"],
  ): Promise<{ text: string; confidence: number }> {
    if (image.byteLength === 0) throw new Error("Hosted OCR received an empty page image");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ProcessTimeoutError(`OCR timed out after ${this.timeoutMs} ms`));
        controller.abort();
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        this.config.recognizeImage({
          image,
          languages,
          apiKey: this.config.apiKey,
          signal: controller.signal,
        }),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
