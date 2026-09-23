import { describe, expect, test } from "bun:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import type { TrayItem } from "../types.ts";
import { UploadFileItem } from "./upload-file-item.tsx";

async function renderWithDetailRoute(ui: JSX.Element): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => <div>{ui}</div>,
  });

  const documentDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$id",
    component: () => <div>Detail Dokumen</div>,
  });

  rootRoute.addChildren([documentDetailRoute]);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  const router = createRouter({ routeTree: rootRoute, history });
  await router.load();

  return renderToString(<RouterProvider router={router} />);
}

describe("UploadFileItem component (FE-S2-01)", () => {
  // AC-03.01: Mencoba mengunggah file duplikat (Negative Path)
  test("AC-03.01: renders duplicate refusal with message and direct link to existing document", async () => {
    const existingId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const item: TrayItem = {
      id: "test-duplicate",
      file: new File(["duplicate-content"], "laporan-keuangan.pdf"),
      filename: "laporan-keuangan.pdf",
      sizeBytes: 40 * 1024,
      progress: 0,
      status: "rejected",
      error: {
        code: "DUPLICATE_CONTENT",
        message: "File ini sudah ada di sistem",
        existingDocumentId: existingId,
      },
    };

    const html = await renderWithDetailRoute(<UploadFileItem item={item} />);

    expect(html).toContain("laporan-keuangan.pdf");
    expect(html).toContain("File ini sudah ada di sistem");
    expect(html).toContain("Lihat dokumen");
    expect(html).toContain(`href="/documents/${existingId}"`);
  });

  // AC-03.02: Mengunggah file bukan duplikat saat file lain sudah ada
  test("AC-03.02: renders non-duplicate alongside existing with success message", async () => {
    const item: TrayItem = {
      id: "test-new",
      file: new File(["new-content"], "presentasi-baru.pdf"),
      filename: "presentasi-baru.pdf",
      sizeBytes: 35 * 1024,
      progress: 100,
      status: "accepted",
      document: {
        id: "new-doc-id-123",
        title: "presentasi-baru.pdf",
        processingState: "queued",
        processingLabel: "Diproses",
      },
    };

    const html = await renderWithDetailRoute(<UploadFileItem item={item} />);

    expect(html).toContain("presentasi-baru.pdf");
    expect(html).toContain("File diterima untuk diproses");
    expect(html).toContain("Diproses");
  });

  test("renders active uploading state with progress bar and byte indicators", async () => {
    const item: TrayItem = {
      id: "test-uploading",
      file: new File(["data"], "surat-penandatanganan.docx"),
      filename: "surat-penandatanganan.docx",
      sizeBytes: 200 * 1024,
      progress: 27,
      status: "uploading",
    };

    const html = await renderWithDetailRoute(<UploadFileItem item={item} />);

    expect(html).toContain("surat-penandatanganan.docx");
    expect(html).toContain("Mengunggah - 27%");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="27"');
    expect(html).toContain('style="width:27%"');
  });
});
