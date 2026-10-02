import type { UploadSingleFileItem } from "@archiva/catalog";
import { AppError } from "@archiva/shared";

const MAX_PREAMBLE_BYTES = 8192;
const MAX_HEADER_BYTES = 8192;
const SNIFF_WINDOW_BYTES = 65536;

function indexOfSubarray(buffer: Uint8Array, pattern: Uint8Array, start = 0): number {
  if (pattern.length === 0) return 0;
  if (buffer.length - start < pattern.length) return -1;
  const end = buffer.length - pattern.length;
  const first = pattern[0];
  for (let i = start; i <= end; i++) {
    if (buffer[i] === first) {
      let match = true;
      for (let j = 1; j < pattern.length; j++) {
        if (buffer[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
  }
  return -1;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] ?? match?.[2]?.trim() ?? null;
}

/**
 * Streams multipart/form-data from request.body, bounding each part by
 * maxBytesPerFile as it arrives. Bytes beyond the limit are discarded
 * so memory is bounded by the tenant limit rather than the transport cap.
 */
export async function collectUploadParts(
  request: Request,
  maxBatch: number,
  maxBytesPerFile: number,
  fieldName = "files",
): Promise<UploadSingleFileItem[]> {
  if (!request.body) return [];

  const contentType = request.headers.get("content-type") ?? "";
  const boundary = extractBoundary(contentType);
  if (!boundary) {
    throw new Error("Missing multipart boundary");
  }

  const boundaryBytes = new TextEncoder().encode(`--${boundary}`);
  const crlfBoundaryBytes = new TextEncoder().encode(`\r\n--${boundary}`);
  const headerEndCrlf = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]);

  const reader = request.body.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  let done = false;

  async function pullMore(): Promise<boolean> {
    if (done) return false;
    const res = await reader.read();
    if (res.done) {
      done = true;
      return false;
    }
    if (res.value && res.value.length > 0) {
      buffer = concat(buffer, res.value);
      return true;
    }
    return pullMore();
  }

  async function ensureBytes(n: number): Promise<boolean> {
    while (buffer.length < n) {
      const ok = await pullMore();
      if (!ok) return false;
    }
    return true;
  }

  // 1. Locate the first boundary delimiter in the stream.
  let preambleSearchStart = 0;
  while (true) {
    const idx = indexOfSubarray(buffer, boundaryBytes, preambleSearchStart);
    if (idx !== -1) {
      buffer = buffer.subarray(idx + boundaryBytes.length);
      break;
    }
    if (buffer.length > MAX_PREAMBLE_BYTES) {
      void reader.cancel();
      throw new Error("No multipart boundary within the preamble limit");
    }
    preambleSearchStart = Math.max(0, buffer.length - boundaryBytes.length + 1);
    const ok = await pullMore();
    if (!ok) {
      void reader.cancel();
      throw new Error("No multipart boundary found in request body");
    }
  }

  await ensureBytes(2);
  if (buffer.length >= 2 && buffer[0] === 0x2d && buffer[1] === 0x2d) {
    void reader.cancel();
    return [];
  }
  if (buffer.length >= 2 && buffer[0] === 0x0d && buffer[1] === 0x0a) {
    buffer = buffer.subarray(2);
  }

  const items: UploadSingleFileItem[] = [];
  let sawFilesField = false;
  const decoder = new TextDecoder();

  while (true) {
    // 2. Read headers until CRLF CRLF.
    let headerSearchStart = 0;
    let headerIdx = indexOfSubarray(buffer, headerEndCrlf, headerSearchStart);
    while (headerIdx === -1) {
      if (buffer.length > MAX_HEADER_BYTES) {
        void reader.cancel();
        throw new Error("Part headers exceed maximum allowed size");
      }
      headerSearchStart = Math.max(0, buffer.length - headerEndCrlf.length + 1);
      const ok = await pullMore();
      if (!ok) {
        void reader.cancel();
        throw new Error("Stream truncated while reading part headers");
      }
      headerIdx = indexOfSubarray(buffer, headerEndCrlf, headerSearchStart);
    }

    const headerText = decoder.decode(buffer.subarray(0, headerIdx));
    buffer = buffer.subarray(headerIdx + 4);

    const nameMatch =
      headerText.match(/name="([^"]+)"/i) || headerText.match(/name=([^;\s\r\n]+)/i);
    const filenameMatch =
      headerText.match(/filename="([^"]+)"/i) || headerText.match(/filename=([^;\s\r\n]+)/i);

    const name = nameMatch?.[1] ?? "";
    const filename = filenameMatch?.[1];
    const isTargetField = name === fieldName;
    if (isTargetField) sawFilesField = true;

    const isFilePart = isTargetField && typeof filename === "string" && filename.length > 0;

    // 3. Read body bytes until boundary.
    const chunks: Uint8Array[] = [];
    let runningBytes = 0;
    let keptBytes = 0;
    const maxBoundaryLen = crlfBoundaryBytes.length;

    function handleBodySlice(slice: Uint8Array): void {
      if (slice.length === 0) return;
      runningBytes += slice.length;
      if (!isFilePart) return;

      if (runningBytes <= maxBytesPerFile) {
        chunks.push(slice);
        keptBytes += slice.length;
      } else if (keptBytes < SNIFF_WINDOW_BYTES) {
        const need = Math.min(slice.length, SNIFF_WINDOW_BYTES - keptBytes);
        chunks.push(slice.subarray(0, need));
        keptBytes += need;
      }
    }

    while (true) {
      const idx = indexOfSubarray(buffer, crlfBoundaryBytes);

      if (idx !== -1) {
        handleBodySlice(buffer.subarray(0, idx));
        buffer = buffer.subarray(idx + crlfBoundaryBytes.length);
        break;
      }

      if (buffer.length >= maxBoundaryLen) {
        const safeLen = buffer.length - (maxBoundaryLen - 1);
        handleBodySlice(buffer.subarray(0, safeLen));
        buffer = buffer.subarray(safeLen);
      }

      const ok = await pullMore();
      if (!ok) {
        void reader.cancel();
        throw new Error("Stream truncated while reading part body");
      }
    }

    if (isFilePart && filename) {
      items.push({
        filename,
        stream: streamFromChunks(chunks),
        sizeBytes: runningBytes,
      });
      if (items.length > maxBatch) {
        void reader.cancel();
        return items;
      }
    }

    // 4. Check for end boundary or next part.
    await ensureBytes(2);
    if (buffer.length >= 2 && buffer[0] === 0x2d && buffer[1] === 0x2d) {
      void reader.cancel();
      break;
    }
    if (buffer.length >= 2 && buffer[0] === 0x0d && buffer[1] === 0x0a) {
      buffer = buffer.subarray(2);
    }
  }

  if (items.length === 0 && sawFilesField) {
    throw new AppError("VALIDATION_ERROR", [{ field: fieldName, issue: "invalid_type" }]);
  }

  return items;
}
