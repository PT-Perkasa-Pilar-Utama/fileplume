import type { OcrProvider, PdfPageRenderer, TextExtractor } from "@archiva/enrichment";
import { err, ok } from "@archiva/shared";
import { extractionFailure } from "./extraction-errors.ts";

export type PdfTextExtractorDeps = {
  renderer: PdfPageRenderer;
  ocr: OcrProvider;
};

const PDF_PAGE_HAS_NO_TEXT = (text: string): boolean => text.trim().length === 0;

/**
 * PDF text, per page, from the embedded text layer first and OCR only for a
 * page that has none. technical-specs/10-integration-points.md 10.7: partial
 * OCR keeps the readable pages; every page failing is unreadable content.
 */
export function createPdfTextExtractor(
  deps: PdfTextExtractorDeps,
  open: (bytes: Uint8Array) => Promise<PdfDocument>,
): (bytes: Uint8Array) => Promise<TextExtractorReturn> {
  return async (bytes) => {
    let document: PdfDocument;
    try {
      document = await open(bytes);
    } catch (error: unknown) {
      return err(extractionFailure(error));
    }
    try {
      return await extractPages(document, bytes, deps);
    } catch (error: unknown) {
      return err(extractionFailure(error));
    } finally {
      await document.destroy();
    }
  };
}

async function extractPages(
  document: PdfDocument,
  bytes: Uint8Array,
  deps: PdfTextExtractorDeps,
): Promise<TextExtractorReturn> {
  const pages: string[] = [];
  let nativePages = 0;
  let ocrPages = 0;
  for (let pageNumber = 1; pageNumber <= document.pageCount; pageNumber++) {
    const native = await pageTextOrEmpty(document, pageNumber);
    if (!PDF_PAGE_HAS_NO_TEXT(native)) {
      pages.push(native);
      nativePages += 1;
      continue;
    }
    const recognized = await recognizePage(deps, bytes, pageNumber);
    pages.push(recognized);
    if (recognized.length > 0) ocrPages += 1;
  }
  if (nativePages + ocrPages === 0) return err({ kind: "UnreadableContent" });
  return ok({
    pages,
    method: nativePages > 0 && ocrPages > 0 ? "mixed" : nativePages > 0 ? "native" : "ocr",
  });
}

/**
 * A text layer that cannot be read for one page is treated as a page with no
 * text, so OCR still gets its chance. The page count is unaffected.
 */
async function pageTextOrEmpty(document: PdfDocument, pageNumber: number): Promise<string> {
  try {
    return await document.pageText(pageNumber);
  } catch {
    return "";
  }
}

/**
 * An unrenderable page stays empty; infrastructure errors reach the stage
 * instead of being reported as unreadable input.
 */
async function recognizePage(
  deps: PdfTextExtractorDeps,
  bytes: Uint8Array,
  pageNumber: number,
): Promise<string> {
  const image = await deps.renderer.render(bytes, pageNumber);
  if (image.byteLength === 0) return "";
  return (await deps.ocr.recognize(image, ["ind", "eng"])).text.trim();
}

/** The PDF reader surface the extractor needs, so the unit test can supply one. */
export interface PdfDocument {
  readonly pageCount: number;
  pageText(pageNumber: number): Promise<string>;
  destroy(): Promise<void>;
}

export type TextExtractorReturn = Awaited<ReturnType<TextExtractor["extract"]>>;
