import { describe, expect, test } from "bun:test";
import type { OcrProvider, PdfPageRenderer } from "@archiva/enrichment";
import type { PdfDocument } from "./pdf-text-extractor.ts";
import { createPdfTextExtractor } from "./pdf-text-extractor.ts";
import { ProcessTimeoutError } from "./process-runner.ts";

function pdfDocument(text: string[]): PdfDocument {
  return {
    pageCount: text.length,
    async pageText(pageNumber) {
      return text[pageNumber - 1] ?? "";
    },
    async destroy() {},
  };
}

function createOcr(texts: Map<number, string>, failures = new Set<number>()): OcrProvider {
  return {
    async recognize(image) {
      const pageNumber = image[0] ?? 0;
      if (failures.has(pageNumber)) return { text: "", confidence: 0 };
      return { text: texts.get(pageNumber) ?? "", confidence: 0.92 };
    },
  };
}

function createRenderer(failures = new Set<number>()): PdfPageRenderer {
  return {
    async render(_pdf, pageNumber) {
      if (failures.has(pageNumber)) return new Uint8Array();
      return new Uint8Array([pageNumber]);
    },
  };
}

const bytes = new Uint8Array([7]);

describe("createPdfTextExtractor (BE-S3-02)", () => {
  test("keeps native text and OCRs only blank pages", async () => {
    const calls: number[] = [];
    const renderer: PdfPageRenderer = {
      async render(_pdf, pageNumber) {
        calls.push(pageNumber);
        return new Uint8Array([pageNumber]);
      },
    };
    const extractor = createPdfTextExtractor(
      { renderer, ocr: createOcr(new Map([[2, "Hasil OCR"]])) },
      async () => pdfDocument(["Teks native", "  "]),
    );

    const result = await extractor(bytes);
    expect(result).toEqual({
      ok: true,
      value: { pages: ["Teks native", "Hasil OCR"], method: "mixed" },
    });
    expect(calls).toEqual([2]);
  });

  test("AC-44.05: partial page failures leave empty page rows when other pages are readable", async () => {
    const extractor = createPdfTextExtractor(
      {
        renderer: createRenderer(new Set([2])),
        ocr: createOcr(new Map([[1, "Halaman terbaca"]]), new Set([3])),
      },
      async () => pdfDocument(["", "", ""]),
    );

    const result = await extractor(bytes);
    expect(result).toEqual({
      ok: true,
      value: { pages: ["Halaman terbaca", "", ""], method: "ocr" },
    });
  });

  test("AC-44.05: every page unreadable returns permanent unreadable content", async () => {
    const extractor = createPdfTextExtractor(
      { renderer: createRenderer(), ocr: createOcr(new Map()) },
      async () => pdfDocument(["", ""]),
    );

    expect(await extractor(bytes)).toEqual({ ok: false, error: { kind: "UnreadableContent" } });
  });

  test("OCR infrastructure failure does not become unreadable content", async () => {
    const cause = new Error("OCR unavailable");
    const extractor = createPdfTextExtractor(
      {
        renderer: createRenderer(),
        ocr: {
          async recognize() {
            throw cause;
          },
        },
      },
      async () => pdfDocument([""]),
    );
    await expect(extractor(bytes)).rejects.toBe(cause);
  });

  test("an OCR timeout propagates as retryable extraction timeout", async () => {
    const extractor = createPdfTextExtractor(
      {
        renderer: createRenderer(),
        ocr: {
          async recognize() {
            throw new ProcessTimeoutError("timed out");
          },
        },
      },
      async () => pdfDocument([""]),
    );

    expect(await extractor(bytes)).toEqual({ ok: false, error: { kind: "ExtractionTimeout" } });
  });

  test("closes the PDF document after extracting", async () => {
    let destroyed = false;
    const extractor = createPdfTextExtractor(
      { renderer: createRenderer(), ocr: createOcr(new Map()) },
      async () => ({
        ...pdfDocument(["Native"]),
        async destroy() {
          destroyed = true;
        },
      }),
    );

    await extractor(bytes);
    expect(destroyed).toBe(true);
  });
});
