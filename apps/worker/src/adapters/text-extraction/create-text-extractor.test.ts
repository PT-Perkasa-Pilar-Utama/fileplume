import { describe, expect, test } from "bun:test";
import { EmptyOcrProvider } from "@archiva/enrichment";
import { createOcrProvider, createTextExtractorFromConfig } from "./create-text-extractor.ts";
import { FallbackOcrProvider } from "./fallback-ocr-provider.ts";
import { TesseractOcrProvider } from "./tesseract-ocr-provider.ts";

const transport = async () => ({ text: "hosted", confidence: 0.9 });

describe("createOcrProvider", () => {
  test("selects Tesseract for on-premises OCR", () => {
    expect(createOcrProvider({ OCR_PROVIDER: "tesseract" })).toBeInstanceOf(TesseractOcrProvider);
  });

  test("selects the packaged fixture adapter for fixture OCR", () => {
    expect(createOcrProvider({ OCR_PROVIDER: "fixture" })).toBeInstanceOf(EmptyOcrProvider);
  });

  test("SCAFFOLD[BE-S3-02]: hosted OCR refuses to build without a vendor transport", () => {
    expect(() => createOcrProvider({ OCR_PROVIDER: "hosted", OCR_API_KEY: "secret" })).toThrow(
      "hosted OCR transport is undefined",
    );
  });

  test("builds hosted OCR with Tesseract as the documented fallback", () => {
    const provider = createOcrProvider(
      { OCR_PROVIDER: "hosted", OCR_API_KEY: "secret" },
      { recognizeImage: transport },
    );
    expect(provider).toBeInstanceOf(FallbackOcrProvider);
  });

  test("refuses hosted OCR without a key", () => {
    expect(() =>
      createOcrProvider({ OCR_PROVIDER: "hosted" }, { recognizeImage: transport }),
    ).toThrow("OCR_API_KEY is required");
  });
});

describe("createTextExtractorFromConfig", () => {
  test("composes native extraction with the configured OCR provider", () => {
    expect(createTextExtractorFromConfig({ OCR_PROVIDER: "fixture" })).toBeDefined();
  });
});
