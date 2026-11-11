import { err, ok } from "@archiva/shared";
import type { TextExtractionFailure } from "../errors.ts";
import type { ExtractedText, TextExtractor } from "../ports.ts";

/** A stable OCR/extraction double, packaged for contract and stage tests. */
export class FixtureExtractor implements TextExtractor {
  constructor(
    private readonly result:
      | { ok: true; value: ExtractedText }
      | { ok: false; error: TextExtractionFailure },
  ) {}

  async extract(_stream: ReadableStream, _mimeType: string): ReturnType<TextExtractor["extract"]> {
    return this.result.ok
      ? ok({ ...this.result.value, pages: [...this.result.value.pages] })
      : err({ ...this.result.error });
  }
}
