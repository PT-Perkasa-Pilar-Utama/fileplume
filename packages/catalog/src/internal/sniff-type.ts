import type { FileType } from "@archiva/shared";

export type SniffResult = {
  mimeType: string;
  fileType: FileType;
};

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04
const WORD_MARKER = new TextEncoder().encode("word/");
const XL_MARKER = new TextEncoder().encode("xl/");

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function containsSequence(bytes: Uint8Array, marker: Uint8Array): boolean {
  if (bytes.length < marker.length) return false;
  outer: for (let i = 0; i <= bytes.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) continue outer;
    }
    return true;
  }
  return false;
}

function isPlainText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  for (const byte of sample) {
    // Null byte or control character other than tab, newline, cr
    if (byte === 0x00) return false;
    if (byte < 0x09 || (byte > 0x0a && byte < 0x0d) || (byte > 0x0d && byte < 0x20)) {
      return false;
    }
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sniffs type from magic bytes. Returns MIME type and fileType or null if unsupported.
 * technical-specs/07-security.md 7.5: never trust filename extension or client MIME.
 */
export function sniffType(headerBytes: Uint8Array): SniffResult | null {
  if (startsWith(headerBytes, PDF_MAGIC)) {
    return {
      mimeType: "application/pdf",
      fileType: "pdf",
    };
  }

  if (startsWith(headerBytes, ZIP_MAGIC)) {
    if (containsSequence(headerBytes, WORD_MARKER)) {
      return {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileType: "docx",
      };
    }
    if (containsSequence(headerBytes, XL_MARKER)) {
      return {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileType: "xlsx",
      };
    }
    return null;
  }

  // Reject known binary signatures
  if (
    (headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff) || // JPEG
    (headerBytes[0] === 0x89 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4e &&
      headerBytes[3] === 0x47) || // PNG
    (headerBytes[0] === 0x47 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46) || // GIF
    (headerBytes[0] === 0x4d && headerBytes[1] === 0x5a) // MZ (exe)
  ) {
    return null;
  }

  if (isPlainText(headerBytes)) {
    return {
      mimeType: "text/plain",
      fileType: "txt",
    };
  }

  return null;
}
