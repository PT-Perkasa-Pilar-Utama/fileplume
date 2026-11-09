import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OcrProvider } from "@archiva/enrichment";
import { ProcessFailedError, ProcessTimeoutError, runProcess } from "./process-runner.ts";

/** technical-specs/10-integration-points.md 10.8 rule 1: OCR is bounded at 180 s per page. */
const OCR_TIMEOUT_MS = 180_000;

export type TesseractConfig = { binary?: string; timeoutMs?: number };

/**
 * On-premises OCR adapter. technical-specs/10-integration-points.md 10.7:
 * `ind` and `eng` traineddata, text plus per-page confidence.
 */
export class TesseractOcrProvider implements OcrProvider {
  private readonly binary: string;
  private readonly timeoutMs: number;

  constructor(config: TesseractConfig = {}) {
    this.binary = config.binary ?? "tesseract";
    this.timeoutMs = config.timeoutMs ?? OCR_TIMEOUT_MS;
  }

  async recognize(
    image: Uint8Array,
    languages: readonly ["ind", "eng"],
  ): Promise<{ text: string; confidence: number }> {
    if (image.byteLength === 0) throw new ProcessFailedError("Tesseract received an empty image");
    const directory = await mkdtemp(join(tmpdir(), "archiva-ocr-"));
    const source = join(directory, "page.png");
    try {
      await writeFile(source, image);
      try {
        const output = await runProcess(
          this.binary,
          [source, "stdout", "-l", languages.join("+"), "tsv"],
          this.timeoutMs,
        );
        return parseTsv(new TextDecoder().decode(output.stdout));
      } catch (error: unknown) {
        if (error instanceof ProcessTimeoutError || error instanceof ProcessFailedError)
          throw error;
        throw new ProcessFailedError("Tesseract did not run", { cause: error });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

const LEVEL = 0;
const CONFIDENCE = 10;
const TEXT = 11;
const WORD_LEVEL = 5;

/**
 * Tesseract's `tsv` output is one header row of tab-separated column names,
 * then one row per layout element. Only level-5 rows are words; confidence is
 * -1 for a row with no recognised word.
 */
export function parseTsv(tsv: string): { text: string; confidence: number } {
  const words: string[] = [];
  let total = 0;
  let counted = 0;
  for (const line of tsv.split("\n").slice(1)) {
    const columns = line.split("\t");
    if (columns.length <= TEXT) continue;
    if (Number(columns[LEVEL]) !== WORD_LEVEL) continue;
    const confidence = Number(columns[CONFIDENCE]);
    const word = (columns[TEXT] ?? "").trim();
    if (!Number.isFinite(confidence) || confidence < 0 || word.length === 0) continue;
    words.push(word);
    total += confidence;
    counted += 1;
  }
  return {
    text: words.join(" "),
    confidence: counted === 0 ? 0 : Math.round((total / counted / 100) * 1000) / 1000,
  };
}
