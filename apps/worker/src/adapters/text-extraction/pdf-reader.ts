import type { TextExtractor } from "@archiva/enrichment";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  InputLimitError,
  PasswordProtectedError,
  UnreadableInputError,
} from "./extraction-errors.ts";
import { createPdfTextExtractor, type PdfDocument } from "./pdf-text-extractor.ts";

/** The complete, ordered set of formats the pipeline can read (AC-01.01). */
export const EXTRACTABLE_MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
} as const;

/**
 * technical-specs/06-data-model.md 6.8: `max_file_size_mb` permits at most 200 MB,
 * so extraction never refuses a file the upload path legitimately accepted.
 */
const MAX_INPUT_BYTES = 200 * 1024 * 1024;

const isPasswordError = (error: unknown): boolean =>
  error instanceof Error && error.name === "PasswordException";

/**
 * Opens a PDF with PDF.js. A password-protected file is a permanent input
 * failure (AC-44.04); an unparseable container is unreadable content (AC-44.05).
 */
export async function openPdf(bytes: Uint8Array): Promise<PdfDocument> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
  let document: Awaited<typeof task.promise>;
  try {
    document = await task.promise;
  } catch (error: unknown) {
    await task.destroy();
    if (isPasswordError(error)) throw new PasswordProtectedError({ cause: error });
    throw new UnreadableInputError("Invalid PDF structure", { cause: error });
  }
  return {
    pageCount: document.numPages,
    async pageText(pageNumber) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .flatMap((item) => ("str" in item ? [item.str] : []))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      page.cleanup();
      return text;
    },
    async destroy() {
      await document.destroy();
    },
  };
}

export async function collectInput(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_INPUT_BYTES) throw new InputLimitError(MAX_INPUT_BYTES);
      chunks.push(value);
    }
  } catch (error: unknown) {
    try {
      await reader.cancel(error);
    } catch (cancelError: unknown) {
      throw new AggregateError([error, cancelError], "Failed to read and cancel extraction input");
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export type { PdfDocument, TextExtractor };
export { createPdfTextExtractor };
