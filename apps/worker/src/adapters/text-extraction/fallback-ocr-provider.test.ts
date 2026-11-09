import { describe, expect, test } from "bun:test";
import type { OcrProvider } from "@archiva/enrichment";
import { FallbackOcrProvider } from "./fallback-ocr-provider.ts";
import { ProcessTimeoutError } from "./process-runner.ts";

function provider(result: () => Promise<{ text: string; confidence: number }>): OcrProvider {
  return { recognize: result };
}

const image = new Uint8Array([1]);

describe("FallbackOcrProvider (10-integration-points 10.7)", () => {
  test("returns the hosted result when it is available", async () => {
    const ocr = new FallbackOcrProvider(
      provider(async () => ({ text: "hosted", confidence: 0.9 })),
      provider(async () => ({ text: "tesseract", confidence: 0.5 })),
    );
    expect(await ocr.recognize(image, ["ind", "eng"])).toEqual({
      text: "hosted",
      confidence: 0.9,
    });
  });

  test("falls back to Tesseract when the hosted service is unavailable", async () => {
    const ocr = new FallbackOcrProvider(
      provider(async () => {
        throw new Error("hosted service returned 503");
      }),
      provider(async () => ({ text: "tesseract", confidence: 0.5 })),
    );
    expect(await ocr.recognize(image, ["ind", "eng"])).toEqual({
      text: "tesseract",
      confidence: 0.5,
    });
  });

  test("propagates a timeout so the stage retries rather than accepting a fallback", async () => {
    const ocr = new FallbackOcrProvider(
      provider(async () => {
        throw new ProcessTimeoutError("timed out");
      }),
      provider(async () => ({ text: "tesseract", confidence: 0.5 })),
    );
    await expect(ocr.recognize(image, ["ind", "eng"])).rejects.toBeInstanceOf(ProcessTimeoutError);
  });
});
