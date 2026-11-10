import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TextExtractor } from "@archiva/enrichment";
import ExcelJS from "exceljs";
import { createNativeTextExtractor } from "./ooxml-text-extractor.ts";
import { EXTRACTABLE_MIME } from "./pdf-reader.ts";

function stream(bytes: Uint8Array): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function extract(extractor: TextExtractor, bytes: Uint8Array, mimeType: string) {
  return extractor.extract(stream(bytes), mimeType);
}

async function fixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(import.meta.dir, "../../../../../fixtures", name)));
}

const noPdf = async () => ({ ok: false as const, error: { kind: "UnreadableContent" as const } });
const encoder = new TextEncoder();

describe("createNativeTextExtractor (BE-S3-02)", () => {
  test("extracts paragraphs from DOCX", async () => {
    const extractor = createNativeTextExtractor(noPdf);
    const result = await extract(
      extractor,
      await fixture("extraction-sample.docx"),
      EXTRACTABLE_MIME.docx,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        pages: ["Paragraf satu", "Paragraf dua"],
        method: "native",
      },
    });
  });

  test("extracts one page per XLSX worksheet", async () => {
    const extractor = createNativeTextExtractor(noPdf);
    const result = await extract(
      extractor,
      await fixture("extraction-sample.xlsx"),
      EXTRACTABLE_MIME.xlsx,
    );
    expect(result).toEqual({
      ok: true,
      value: { pages: ["Header\tValue\nMetric\t42"], method: "native" },
    });
  });

  test("extracts all rich text runs from XLSX cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.getCell("A1").value = { richText: [{ text: "Annual " }, { text: "report" }] };
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const result = await extract(createNativeTextExtractor(noPdf), bytes, EXTRACTABLE_MIME.xlsx);
    expect(result).toEqual({
      ok: true,
      value: { pages: ["Annual report"], method: "native" },
    });
  });

  test("rejects a malformed DOCX as unreadable content", async () => {
    const extractor = createNativeTextExtractor(noPdf);
    const result = await extract(extractor, encoder.encode("not a zip"), EXTRACTABLE_MIME.docx);
    expect(result).toEqual({ ok: false, error: { kind: "UnreadableContent" } });
  });

  test("extracts plain text without regressing TXT", async () => {
    const extractor = createNativeTextExtractor(noPdf);
    const result = await extract(
      extractor,
      encoder.encode("Baris satu\nBaris dua"),
      EXTRACTABLE_MIME.txt,
    );
    expect(result).toEqual({
      ok: true,
      value: { pages: ["Baris satu", "Baris dua"], method: "native" },
    });
  });

  test("rejects invalid UTF-8 as unreadable content", async () => {
    const extractor = createNativeTextExtractor(noPdf);
    const result = await extract(extractor, new Uint8Array([0xff]), EXTRACTABLE_MIME.txt);
    expect(result).toEqual({ ok: false, error: { kind: "UnreadableContent" } });
  });

  test("rejects unsupported MIME without parsing content", async () => {
    const extractor = createNativeTextExtractor(noPdf);
    const result = await extract(extractor, encoder.encode("x"), "application/octet-stream");
    expect(result).toEqual({ ok: false, error: { kind: "UnsupportedMimeType" } });
  });

  test("calls the PDF implementation for PDF input", async () => {
    let seenBytes: Uint8Array | undefined;
    const extractor = createNativeTextExtractor(async (bytes) => {
      seenBytes = bytes;
      return { ok: true, value: { pages: ["PDF text"], method: "native" } };
    });
    const result = await extract(extractor, encoder.encode("pdf bytes"), EXTRACTABLE_MIME.pdf);
    expect(result).toEqual({ ok: true, value: { pages: ["PDF text"], method: "native" } });
    expect(seenBytes).toEqual(encoder.encode("pdf bytes"));
  });
});
