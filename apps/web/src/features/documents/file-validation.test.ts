import { describe, expect, test } from "bun:test";
import { ERROR_MESSAGES } from "@archiva/shared";
import {
  DEFAULT_MAX_FILE_SIZE_MB,
  getAcceptedFileType,
  getAcceptedFileTypeByName,
  validateBatchCount,
  validateFile,
} from "./file-validation.ts";

describe("file-validation pre-checks (FE-S2-01)", () => {
  // AC-01.05: Melebihi batas jumlah file sekaligus (Negative Path)
  test("AC-01.05: validateBatchCount rejects count > 20 with exact Indonesian message", () => {
    const validResult = validateBatchCount(20);
    expect(validResult.valid).toBe(true);
    expect("error" in validResult).toBe(false);

    const overLimit = validateBatchCount(25);
    expect(overLimit.valid).toBe(false);
    if (!overLimit.valid) {
      expect(overLimit.error).toBe("Maksimal 20 file per unggahan");
      expect(overLimit.error).toBe(ERROR_MESSAGES.BATCH_TOO_LARGE);
    }
  });

  test("getAcceptedFileTypeByName identifies type from filename", () => {
    expect(getAcceptedFileTypeByName("laporan.pdf")).toBe("pdf");
    expect(getAcceptedFileTypeByName("surat.docx")).toBe("docx");
    expect(getAcceptedFileTypeByName("data.xlsx")).toBe("xlsx");
    expect(getAcceptedFileTypeByName("catatan.txt")).toBe("txt");
    expect(getAcceptedFileTypeByName("foto.png")).toBeNull();
  });

  test("getAcceptedFileType identifies pdf, docx, xlsx, txt by extension and MIME", () => {
    const pdfFile = new File(["test"], "laporan.pdf", { type: "application/pdf" });
    expect(getAcceptedFileType(pdfFile)).toBe("pdf");

    const docxFile = new File(["test"], "surat.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(getAcceptedFileType(docxFile)).toBe("docx");

    const xlsxFile = new File(["test"], "data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(getAcceptedFileType(xlsxFile)).toBe("xlsx");

    const txtFile = new File(["test"], "catatan.txt", { type: "text/plain" });
    expect(getAcceptedFileType(txtFile)).toBe("txt");

    // Case insensitivity
    const upperPdf = new File(["test"], "DOKUMEN.PDF");
    expect(getAcceptedFileType(upperPdf)).toBe("pdf");

    // Unsupported
    const jpgFile = new File(["test"], "invoice.jpg", { type: "image/jpeg" });
    expect(getAcceptedFileType(jpgFile)).toBeNull();

    const pngFile = new File(["test"], "foto.png", { type: "image/png" });
    expect(getAcceptedFileType(pngFile)).toBeNull();
  });

  // AC-01.03: Mencoba mengunggah file tipe tidak didukung (Negative Path)
  test("AC-01.03: validateFile rejects unsupported image format with verbatim error message", () => {
    const jpgFile = new File(["image-bytes"], "invoice.jpg", { type: "image/jpeg" });
    const result = validateFile(jpgFile);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe("UNSUPPORTED_TYPE");
      expect(result.error.message).toBe(
        "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT",
      );
      expect(result.error.message).toBe(ERROR_MESSAGES.UNSUPPORTED_TYPE);
    }
  });

  // AC-01.06: Melebihi batas ukuran file (Negative Path)
  test("AC-01.06: validateFile rejects file size exceeding 20 MB with verbatim error message", () => {
    const maxBytes = DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024;
    const oversizedBytes = 25 * 1024 * 1024;

    // Simulate 25 MB file
    const oversizedFile = new File(["dummy"], "laporan-besar.pdf", { type: "application/pdf" });
    Object.defineProperty(oversizedFile, "size", { value: oversizedBytes });

    const result = validateFile(oversizedFile, 20);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe("FILE_TOO_LARGE");
      expect(result.error.message).toBe("Ukuran file melebihi batas 20 MB");
    }

    // Within limit
    const validFile = new File(["dummy"], "laporan-pas.pdf", { type: "application/pdf" });
    Object.defineProperty(validFile, "size", { value: maxBytes });
    const validResult = validateFile(validFile, 20);
    expect(validResult.valid).toBe(true);
  });
});
