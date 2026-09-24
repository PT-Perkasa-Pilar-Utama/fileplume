import { describe, expect, test } from "bun:test";
import { FileText } from "lucide-react";
import { renderToString } from "react-dom/server";
import { EmptyState } from "./empty-state.tsx";

describe("EmptyState component", () => {
  test("renders default card variant with icon, title, and description", () => {
    const html = renderToString(
      <EmptyState
        icon={FileText}
        title="Belum ada dokumen"
        description="Silakan unggah dokumen baru."
      />,
    );

    expect(html).toContain("Belum ada dokumen");
    expect(html).toContain("Silakan unggah dokumen baru.");
    expect(html).toContain("lucide-file-text");
    expect(html).toContain("bg-card");
  });

  test("renders dashed variant for dropzone/tray areas", () => {
    const html = renderToString(
      <EmptyState variant="dashed" title="Area Kosong" description="Seret file ke sini" />,
    );

    expect(html).toContain("Area Kosong");
    expect(html).toContain("Seret file ke sini");
    expect(html).toContain("border-dashed");
  });

  test("renders compact variant for tables", () => {
    const html = renderToString(<EmptyState variant="compact" title="Belum ada data." />);

    expect(html).toContain("Belum ada data.");
    expect(html).toContain("h-32");
  });

  test("renders borderless variant for card containers", () => {
    const html = renderToString(
      <EmptyState
        variant="borderless"
        icon={FileText}
        title="Belum ada dokumen yang diunggah"
        description="Silakan unggah dokumen terlebih dahulu."
      />,
    );

    expect(html).toContain("Belum ada dokumen yang diunggah");
    expect(html).toContain("Silakan unggah dokumen terlebih dahulu.");
    expect(html).toContain("bg-transparent");
  });
});
