import { Readable } from "node:stream";
import type { ExtractedText, TextExtractor } from "@archiva/enrichment";
import { err, ok } from "@archiva/shared";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractionFailure, UnreadableInputError } from "./extraction-errors.ts";
import { collectInput, EXTRACTABLE_MIME } from "./pdf-reader.ts";

type ExtractionOutcome = Awaited<ReturnType<TextExtractor["extract"]>>;

/** Word paragraphs are the page-level unit consumed by the search index. */
async function extractDocx(bytes: Uint8Array): Promise<ExtractedText> {
  let result: Awaited<ReturnType<typeof mammoth.extractRawText>>;
  try {
    result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  } catch (cause: unknown) {
    throw new UnreadableInputError("DOCX container is unreadable", { cause });
  }
  const paragraphs = result.value
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  if (paragraphs.length === 0) throw new UnreadableInputError("DOCX contains no readable text");
  return { pages: paragraphs, method: "native" };
}

/** Each worksheet is one indexable page; each row remains a tab-separated line. */
async function extractXlsx(bytes: Uint8Array): Promise<ExtractedText> {
  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS's `load` expects its own Buffer type. `read` accepts any stream.
    await workbook.xlsx.read(Readable.from(Buffer.from(bytes)));
  } catch (cause: unknown) {
    throw new UnreadableInputError("XLSX container is unreadable", { cause });
  }
  const pages: string[] = [];
  for (const worksheet of workbook.worksheets) {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values;
      const cells = Array.isArray(values) ? values.slice(1) : [];
      rows.push(cells.map(cellText).join("\t").trimEnd());
    });
    pages.push(rows.join("\n").trim());
  }
  if (pages.length === 0 || pages.every((page) => page.length === 0)) {
    throw new UnreadableInputError("XLSX contains no readable worksheets");
  }
  return { pages, method: "native" };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(" ");
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map(cellText).join("");
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  if (typeof value === "object" && "result" in value) return cellText(value.result);
  if (typeof value === "object" && "hyperlink" in value && typeof value.hyperlink === "string") {
    return value.hyperlink;
  }
  return "";
}

function textFile(bytes: Uint8Array): ExtractedText {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  } catch (cause: unknown) {
    throw new UnreadableInputError("TXT is not valid UTF-8", { cause });
  }
  if (text.length === 0) throw new UnreadableInputError("TXT contains no readable text");
  return { pages: text.split(/\n+/), method: "native" };
}

/** Native PDF, DOCX, XLSX, and TXT extraction behind the enrichment port. */
export function createNativeTextExtractor(
  pdfExtract: (bytes: Uint8Array) => Promise<ExtractionOutcome>,
): TextExtractor {
  return {
    async extract(stream, mimeType) {
      // A failed read is infrastructure, not a property of the file: let it reach
      // the stage, which classifies it as transient and retries.
      const bytes = await collectInput(stream);
      try {
        switch (mimeType) {
          case EXTRACTABLE_MIME.pdf:
            return await pdfExtract(bytes);
          case EXTRACTABLE_MIME.docx:
            return ok(await extractDocx(bytes));
          case EXTRACTABLE_MIME.xlsx:
            return ok(await extractXlsx(bytes));
          case EXTRACTABLE_MIME.txt:
            return ok(textFile(bytes));
          default:
            return err({ kind: "UnsupportedMimeType" });
        }
      } catch (error: unknown) {
        return err(extractionFailure(error));
      }
    },
  };
}
