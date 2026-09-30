import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { FileTypeIcon } from "./file-type-icon.tsx";

describe("FileTypeIcon component (AC-38.01)", () => {
  // AC-38.01: ikon tipe file (PDF/DOCX/XLSX/TXT)
  test("AC-38.01: renders PDF icon with correct testid and aria-label", () => {
    const html = renderToString(<FileTypeIcon fileType="pdf" />);
    expect(html).toContain('data-testid="file-icon-pdf"');
    expect(html).toContain('aria-label="File PDF"');
  });

  test("AC-38.01: renders DOCX icon with correct testid and aria-label", () => {
    const html = renderToString(<FileTypeIcon fileType="docx" />);
    expect(html).toContain('data-testid="file-icon-docx"');
    expect(html).toContain('aria-label="File DOCX"');
  });

  test("AC-38.01: renders XLSX icon with correct testid and aria-label", () => {
    const html = renderToString(<FileTypeIcon fileType="xlsx" />);
    expect(html).toContain('data-testid="file-icon-xlsx"');
    expect(html).toContain('aria-label="File XLSX"');
  });

  test("AC-38.01: renders TXT icon with correct testid and aria-label", () => {
    const html = renderToString(<FileTypeIcon fileType="txt" />);
    expect(html).toContain('data-testid="file-icon-txt"');
    expect(html).toContain('aria-label="File TXT"');
  });

  test("renders fallback icon for unsupported or other file types", () => {
    const htmlOther = renderToString(<FileTypeIcon fileType="other" />);
    expect(htmlOther).toContain('data-testid="file-icon-other"');

    const htmlUnsupported = renderToString(<FileTypeIcon fileType="unsupported" />);
    expect(htmlUnsupported).toContain('data-testid="file-icon-unsupported"');
  });

  test("applies size classes appropriately", () => {
    const htmlSm = renderToString(<FileTypeIcon fileType="pdf" size="sm" />);
    expect(htmlSm).toContain("size-7");

    const htmlLg = renderToString(<FileTypeIcon fileType="pdf" size="lg" />);
    expect(htmlLg).toContain("size-12");
  });
});
