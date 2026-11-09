import { describe, expect, test } from "bun:test";
import { parseTsv } from "./tesseract-ocr-provider.ts";

/** Tesseract `tsv` output: header row, then one row per word. */
const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

function row(level: number, conf: number, text: string): string {
  return [level, 1, 1, 1, 1, 1, 0, 0, 10, 10, conf, text].join("\t");
}

describe("parseTsv (BE-S3-02)", () => {
  test("returns recognised words and their mean confidence", () => {
    const tsv = [HEADER, row(5, 90, "Kontrak"), row(5, 80, "kerja"), row(5, 70, "sama")].join("\n");
    const result = parseTsv(tsv);
    expect(result.text).toBe("Kontrak kerja sama");
    expect(result.confidence).toBe(0.8);
  });

  test("ignores structural rows and rows with no recognised word", () => {
    const tsv = [
      HEADER,
      row(1, -1, ""),
      row(2, -1, ""),
      row(5, -1, "noise"),
      row(5, 95, "Berkas"),
    ].join("\n");
    const result = parseTsv(tsv);
    expect(result.text).toBe("Berkas");
    expect(result.confidence).toBe(0.95);
  });

  test("returns zero confidence when no word was recognised", () => {
    expect(parseTsv(HEADER)).toEqual({ text: "", confidence: 0 });
  });
});
