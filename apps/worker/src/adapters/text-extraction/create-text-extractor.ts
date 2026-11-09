import type { Config } from "@archiva/config";
import type { OcrProvider, TextExtractor } from "@archiva/enrichment";
import { EmptyOcrProvider } from "@archiva/enrichment";
import { FallbackOcrProvider } from "./fallback-ocr-provider.ts";
import { HostedOcrProvider, type RecognizeImage } from "./hosted-ocr-provider.ts";
import { createNativeTextExtractor } from "./ooxml-text-extractor.ts";
import { PopplerPdfPageRenderer } from "./pdf-page-renderer.ts";
import { openPdf } from "./pdf-reader.ts";
import { createPdfTextExtractor } from "./pdf-text-extractor.ts";
import { TesseractOcrProvider } from "./tesseract-ocr-provider.ts";

export type TextExtractorOptions = {
  /** Required for `OCR_PROVIDER=hosted`; the vendor transport is an open contract. */
  recognizeImage?: RecognizeImage;
};

export type OcrConfig = Pick<Config, "OCR_PROVIDER" | "OCR_API_KEY">;

/**
 * Composes the production extractor from configuration.
 * technical-specs/10-integration-points.md 10.7 and 11-environment-configuration.md 11.3.
 */
export function createTextExtractorFromConfig(
  config: OcrConfig,
  options: TextExtractorOptions = {},
): TextExtractor {
  const ocr = createOcrProvider(config, options);
  const pdf = createPdfTextExtractor({ renderer: new PopplerPdfPageRenderer(), ocr }, openPdf);
  return createNativeTextExtractor(pdf);
}

/** technical-specs/11-environment-configuration.md 11.3: the closed provider set. */
export function createOcrProvider(
  config: OcrConfig,
  options: TextExtractorOptions = {},
): OcrProvider {
  switch (config.OCR_PROVIDER) {
    case "tesseract":
      return new TesseractOcrProvider();
    case "fixture":
      return new EmptyOcrProvider();
    case "hosted": {
      if (config.OCR_API_KEY === undefined) {
        throw new Error("OCR_API_KEY is required when OCR_PROVIDER=hosted");
      }
      if (options.recognizeImage === undefined) {
        throw new Error(
          "SCAFFOLD[BE-S3-02]: hosted OCR transport is undefined; docs/technical-specs/10-integration-points.md 10.7 names no vendor contract",
        );
      }
      return new FallbackOcrProvider(
        new HostedOcrProvider({
          apiKey: config.OCR_API_KEY,
          recognizeImage: options.recognizeImage,
        }),
        new TesseractOcrProvider(),
      );
    }
  }
}
