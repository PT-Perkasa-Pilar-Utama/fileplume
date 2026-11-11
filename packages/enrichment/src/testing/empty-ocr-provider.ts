import type { OcrProvider } from "@archiva/enrichment";

/**
 * Test-only OCR double. It recognises nothing, so a scanned page stays empty and
 * the pipeline's partial-text rules are exercised without invented content.
 */
export class EmptyOcrProvider implements OcrProvider {
  async recognize(
    _image: Uint8Array,
    _languages: readonly ["ind", "eng"],
  ): Promise<{ text: string; confidence: number }> {
    return { text: "", confidence: 0 };
  }
}
