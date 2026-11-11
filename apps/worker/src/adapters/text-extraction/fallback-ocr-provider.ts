import type { OcrProvider } from "@archiva/enrichment";
import { ProcessTimeoutError } from "./process-runner.ts";

export type OcrResult = { text: string; confidence: number };

/**
 * technical-specs/10-integration-points.md 10.7: Tesseract is the second attempt
 * when the hosted service is unavailable. A timeout is not the hosted service
 * being unavailable, so it propagates and the stage retries instead.
 */
export class FallbackOcrProvider implements OcrProvider {
  constructor(
    private readonly primary: OcrProvider,
    private readonly fallback: OcrProvider,
  ) {}

  async recognize(image: Uint8Array, languages: readonly ["ind", "eng"]): Promise<OcrResult> {
    try {
      return await this.primary.recognize(image, languages);
    } catch (error: unknown) {
      if (error instanceof ProcessTimeoutError) throw error;
      return this.fallback.recognize(image, languages);
    }
  }
}
