import { describe, expect, test } from "bun:test";
import { EMPTY_STATE } from "@archiva/shared";
import { renderToString } from "react-dom/server";
import { DocumentEmptyState } from "./document-empty-state.tsx";

describe("DocumentEmptyState component (AC-38.03)", () => {
  // AC-38.03: Dasbor tanpa dokumen
  test("AC-38.03: renders server message 'Belum ada dokumen. Seret file ke area unggah untuk memulai' by default", () => {
    const html = renderToString(<DocumentEmptyState />);

    expect(html).toContain('data-testid="documents-empty-state"');
    expect(html).toContain('data-testid="empty-state-message"');
    expect(html).toContain(EMPTY_STATE.NO_DOCUMENTS);
    expect(html).toContain("Belum ada dokumen. Seret file ke area unggah untuk memulai");
  });

  test("AC-38.03: renders custom message from server meta.message when provided", () => {
    const customMessage = "Tidak ada dokumen pada kategori ini";
    const html = renderToString(<DocumentEmptyState message={customMessage} />);

    expect(html).toContain(customMessage);
    expect(html).toContain('data-testid="empty-state-message"');
  });
});
