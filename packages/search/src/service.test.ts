import { describe, expect, test } from "bun:test";
import { isExactPhrase, isQueryLongEnough, pageDocumentId, RELATED_LIMIT } from "./service.ts";

describe("query length guard", () => {
  test("one character is refused without touching the engine", () => {
    // AC-07.03
    expect(isQueryLongEnough("a")).toBe(false);
  });

  test("whitespace does not count toward the minimum", () => {
    expect(isQueryLongEnough("   ")).toBe(false);
  });

  test("two characters pass", () => {
    expect(isQueryLongEnough("ab")).toBe(true);
  });
});

describe("exact phrase detection", () => {
  test("a quoted hyphenated term is an exact phrase", () => {
    // AC-33.01 searches "klausul-kerahasiaan".
    expect(isExactPhrase('"klausul-kerahasiaan"')).toBe(true);
  });

  test("an unquoted term is not", () => {
    expect(isExactPhrase("klausul-kerahasiaan")).toBe(false);
  });

  test("a lone quote character is not a phrase", () => {
    expect(isExactPhrase('"')).toBe(false);
  });
});

describe("page document id", () => {
  test("is stable, so re-indexing overwrites rather than duplicates", () => {
    expect(pageDocumentId("v1", 15)).toBe("v1:15");
    expect(pageDocumentId("v1", 15)).toBe(pageDocumentId("v1", 15));
  });
});

describe("related documents", () => {
  test("the cap is five", () => {
    // AC-08.01 says maksimal 5.
    expect(RELATED_LIMIT).toBe(5);
  });
});
