import { describe, expect, test } from "bun:test";
import { AppError } from "@archiva/shared";
import { collectUploadParts } from "./collect-upload-parts.ts";

function makeRequest(bytes: Uint8Array<ArrayBuffer>, boundary = "testboundary"): Request {
  // Allowlisted cast: Response.body is always a ReadableStream.
  const stream = new Response(bytes).body as ReadableStream;
  return new Request("http://localhost/upload", {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body: stream,
  });
}

describe("collectUploadParts malformed and bounded paths (F9, F11)", () => {
  test("returns empty array when request has no body", async () => {
    const req = new Request("http://localhost/upload", { method: "POST" });
    const items = await collectUploadParts(req, 20, 1024 * 1024);
    expect(items).toEqual([]);
  });

  test("throws when Content-Type lacks multipart boundary", async () => {
    // Allowlisted cast: Response.body is always a ReadableStream.
    const stream = new Response(new Uint8Array(10)).body as ReadableStream;
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data" },
      body: stream,
    });
    expect(collectUploadParts(req, 20, 1024 * 1024)).rejects.toThrow("Missing multipart boundary");
  });

  test("throws when preamble exceeds MAX_PREAMBLE_BYTES without boundary (F9)", async () => {
    const preamble = new Uint8Array(8193).fill(0x61);
    const req = makeRequest(preamble, "myboundary");
    expect(collectUploadParts(req, 20, 1024 * 1024)).rejects.toThrow(
      "No multipart boundary within the preamble limit",
    );
  });

  test("throws when no boundary found before stream ends", async () => {
    const shortPreamble = new TextEncoder().encode("short text with no boundary");
    const req = makeRequest(shortPreamble, "myboundary");
    expect(collectUploadParts(req, 20, 1024 * 1024)).rejects.toThrow(
      "No multipart boundary found in request body",
    );
  });

  test("returns empty array when stream immediately closes with boundary delimiter", async () => {
    const boundary = "myboundary";
    const bytes = new TextEncoder().encode(`--${boundary}--\r\n`);
    const req = makeRequest(bytes, boundary);
    const items = await collectUploadParts(req, 20, 1024 * 1024);
    expect(items).toEqual([]);
  });

  test("throws when part header exceeds MAX_HEADER_BYTES without CRLF CRLF (F9)", async () => {
    const boundary = "myboundary";
    const start = new TextEncoder().encode(`--${boundary}\r\n`);
    const longHeader = new Uint8Array(8193).fill(0x62);
    const combined = new Uint8Array(start.length + longHeader.length);
    combined.set(start, 0);
    combined.set(longHeader, start.length);
    const req = makeRequest(combined, boundary);
    expect(collectUploadParts(req, 20, 1024 * 1024)).rejects.toThrow(
      "Part headers exceed maximum allowed size",
    );
  });

  test("throws when stream ends abruptly while reading part headers", async () => {
    const boundary = "myboundary";
    const truncatedHeaders = new TextEncoder().encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"`,
    );
    const req = makeRequest(truncatedHeaders, boundary);
    expect(collectUploadParts(req, 20, 1024 * 1024)).rejects.toThrow(
      "Stream truncated while reading part headers",
    );
  });

  test("throws when stream ends abruptly while reading part body", async () => {
    const boundary = "myboundary";
    const bodyText =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="doc.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `some body content but stream terminates without boundary`;
    const bytes = new TextEncoder().encode(bodyText);
    const req = makeRequest(bytes, boundary);
    expect(collectUploadParts(req, 20, 1024 * 1024)).rejects.toThrow(
      "Stream truncated while reading part body",
    );
  });

  test("throws AppError validation error when files field has no filename", async () => {
    const boundary = "myboundary";
    const bodyText =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"\r\n\r\n` +
      `some text value\r\n` +
      `--${boundary}--\r\n`;
    const bytes = new TextEncoder().encode(bodyText);
    const req = makeRequest(bytes, boundary);
    try {
      await collectUploadParts(req, 20, 1024 * 1024);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      if (err instanceof AppError) {
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.details).toEqual([{ field: "files", issue: "invalid_type" }]);
      }
    }
  });

  test("cancels reader and returns items when batch limit is exceeded (F9)", async () => {
    const boundary = "myboundary";
    let bodyText = "";
    for (let i = 0; i < 5; i++) {
      bodyText +=
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files"; filename="doc${i}.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `content ${i}\r\n`;
    }
    bodyText += `--${boundary}--\r\n`;
    const bytes = new TextEncoder().encode(bodyText);
    let cancelled = false;
    let sent = false;
    const rawStream = new ReadableStream({
      pull(controller) {
        if (!sent) {
          controller.enqueue(bytes);
          sent = true;
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: rawStream,
    });
    const items = await collectUploadParts(req, 3, 1024 * 1024);
    expect(items.length).toBeGreaterThan(3);
    expect(cancelled).toBe(true);
  });
});
