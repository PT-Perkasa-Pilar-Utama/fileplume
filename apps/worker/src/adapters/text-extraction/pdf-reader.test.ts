import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { collectInput, openPdf } from "./pdf-reader.ts";

async function fixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(import.meta.dir, "../../../../../fixtures", name)));
}

describe("collectInput", () => {
  test("concatenates stream chunks into one buffer", async () => {
    const first = new TextEncoder().encode("abc");
    const second = new TextEncoder().encode("def");
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(first);
        controller.enqueue(second);
        controller.close();
      },
    });

    expect(await collectInput(input)).toEqual(new TextEncoder().encode("abcdef"));
  });

  test("cancels the stream when a chunk is not a byte array", async () => {
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue("not bytes");
        controller.close();
      },
    });

    await expect(collectInput(input)).rejects.toThrow();
  });
});

describe("openPdf (BE-S3-02)", () => {
  test("AC-33.01: reads the native text layer page by page", async () => {
    const document = await openPdf(await fixture("kontrak-kerjasama.pdf"));
    try {
      expect(document.pageCount).toBe(16);
      expect(await document.pageText(15)).toContain("klausul-kerahasiaan");
      expect(await document.pageText(1)).toContain("Halaman 1");
    } finally {
      await document.destroy();
    }
  });

  test("preserves PDF bytes for OCR after opening the document", async () => {
    const bytes = await fixture("laporan-keuangan.pdf");
    const original = bytes.slice();
    const document = await openPdf(bytes);
    try {
      expect(bytes).toEqual(original);
    } finally {
      await document.destroy();
    }
  });

  test("AC-44.04: an encrypted PDF is reported as password protected", async () => {
    const bytes = await fixture("terproteksi-password.pdf");
    await expect(openPdf(bytes)).rejects.toMatchObject({ name: "PasswordProtectedError" });
  });

  test("AC-44.05: a truncated PDF is reported as unreadable content", async () => {
    await expect(openPdf(new TextEncoder().encode("%PDF-1.7\nbroken"))).rejects.toMatchObject({
      name: "UnreadableInputError",
    });
  });

  test("reads a stream that yields chunks one at a time", async () => {
    const bytes = await fixture("laporan-keuangan.pdf");
    const chunked = new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    expect(await collectInput(chunked)).toEqual(bytes);
  });
});
