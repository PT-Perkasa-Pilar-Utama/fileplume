import { describe, expect, test } from "bun:test";
import { AppError, formatErrorMessage, HTTP_STATUS } from "./errors.ts";

describe("error taxonomy", () => {
  test("FILE_TOO_LARGE interpolates the tenant's current limit", () => {
    // AC-01.06
    expect(formatErrorMessage("FILE_TOO_LARGE", { n: 20 })).toBe(
      "Ukuran file melebihi batas 20 MB",
    );
    expect(HTTP_STATUS.FILE_TOO_LARGE).toBe(422);
  });

  test("VALUE_OUT_OF_RANGE interpolates the key's range and unit", () => {
    // AC-42.04
    expect(formatErrorMessage("VALUE_OUT_OF_RANGE", { min: 1, max: 200, unit: "MB" })).toBe(
      "Nilai harus antara 1 dan 200 MB",
    );
    expect(HTTP_STATUS.VALUE_OUT_OF_RANGE).toBe(422);
  });

  test("a message without placeholders is returned verbatim", () => {
    expect(formatErrorMessage("TOO_MANY_TAGS")).toBe("Maksimal 3 tag per dokumen");
    expect(formatErrorMessage("INVALID_EMAIL")).toBe("Format email tidak valid");
    expect(formatErrorMessage("PASSWORD_REQUIRED")).toBe("Password wajib diisi");
    expect(HTTP_STATUS.INVALID_EMAIL).toBe(422);
    expect(HTTP_STATUS.PASSWORD_REQUIRED).toBe(422);
  });

  test("a missing placeholder is a programmer error, never a raw brace on the wire", () => {
    expect(() => formatErrorMessage("FILE_TOO_LARGE")).toThrow("{n}");
    expect(() => new AppError("VALUE_OUT_OF_RANGE")).toThrow("{min}");
  });

  test("AppError carries a formatted message and the mapped status", () => {
    const message = formatErrorMessage("FILE_TOO_LARGE", { n: 50 });
    const error = new AppError("FILE_TOO_LARGE", undefined, message);
    expect(error.message).toBe("Ukuran file melebihi batas 50 MB");
    expect(error.status).toBe(422);
  });
});
