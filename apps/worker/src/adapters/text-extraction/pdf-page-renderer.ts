import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PdfPageRenderer } from "@archiva/enrichment";
import { ProcessFailedError, ProcessTimeoutError, runProcess } from "./process-runner.ts";

const RENDER_TIMEOUT_MS = 60_000;

/**
 * Poppler renderer for OCR pages. The caller invokes it only without native
 * text. A page Poppler refuses is a page-level failure, so it yields no image
 * and the extractor records an empty page; a timeout stays retryable.
 */
export class PopplerPdfPageRenderer implements PdfPageRenderer {
  constructor(private readonly binary = "pdftoppm") {}

  async render(pdf: Uint8Array, pageNumber: number): Promise<Uint8Array> {
    const directory = await mkdtemp(join(tmpdir(), "archiva-pdf-page-"));
    const source = join(directory, "source.pdf");
    const prefix = join(directory, "page");
    try {
      await writeFile(source, pdf);
      try {
        await runProcess(
          this.binary,
          [
            "-f",
            String(pageNumber),
            "-l",
            String(pageNumber),
            "-singlefile",
            "-png",
            source,
            prefix,
          ],
          RENDER_TIMEOUT_MS,
        );
      } catch (error: unknown) {
        if (error instanceof ProcessTimeoutError) throw error;
        if (error instanceof ProcessFailedError) return new Uint8Array();
        throw error;
      }
      try {
        return new Uint8Array(await readFile(`${prefix}.png`));
      } catch {
        // Poppler exited 0 but wrote no image: this page produced nothing to OCR.
        return new Uint8Array();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
