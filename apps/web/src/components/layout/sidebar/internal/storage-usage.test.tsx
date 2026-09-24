import { describe, expect, test } from "bun:test";
import type { StorageView } from "@archiva/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { StorageUsage } from "./storage-usage.tsx";

describe("StorageUsage component (FE-S2-02)", () => {
  // AC-35.01: Melihat informasi kapasitas penyimpanan
  test("AC-35.01: renders storage capacity percentage (25%) and visual progress bar", () => {
    const storage: StorageView = {
      usedBytes: 13421772800,
      quotaBytes: 53687091200,
      percent: 25,
      level: "ok",
      message: null,
    };

    const html = renderToStaticMarkup(<StorageUsage storage={storage} />);

    // Persentase penggunaan 25%
    expect(html).toContain("Storage Usage");
    expect(html).toContain("25%");

    // Indikator visual (progress bar)
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("width:25%");
    expect(html).toContain("bg-primary");
    expect(html).toContain('data-level="ok"');
    expect(html).toContain("h-1");
    expect(html).toContain("font-medium");
    expect(html).toContain("font-normal");

    // Tidak ada pesan peringatan saat level ok
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Kapasitas penyimpanan hampir penuh");
  });

  // AC-35.02: Mendapat peringatan kapasitas hampir penuh
  test("AC-35.02: changes color to warning and renders verbatim warning banner at 80% usage", () => {
    const storage: StorageView = {
      usedBytes: 42949672960,
      quotaBytes: 53687091200,
      percent: 80,
      level: "warning",
      message: "Kapasitas penyimpanan hampir penuh",
    };

    const html = renderToStaticMarkup(<StorageUsage storage={storage} />);

    // Persentase penggunaan 80%
    expect(html).toContain("80%");

    // Indikator berubah warna menjadi kuning atau oranye (warning)
    expect(html).toContain("bg-warning");
    expect(html).toContain('data-level="warning"');

    // Pesan peringatan verbatim sesuai kriteria AC-35.02
    expect(html).toContain('role="alert"');
    expect(html).toContain("Kapasitas penyimpanan hampir penuh");
    expect(html).toContain("bg-alert-warning-bg");
    expect(html).toContain("border-alert-warning-border");
    expect(html).toContain("text-alert-warning-text");
  });

  test("renders full capacity state with destructive color and full message", () => {
    const storage: StorageView = {
      usedBytes: 53687091200,
      quotaBytes: 53687091200,
      percent: 100,
      level: "full",
      message: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    };

    const html = renderToStaticMarkup(<StorageUsage storage={storage} />);

    expect(html).toContain("100%");
    expect(html).toContain("bg-destructive");
    expect(html).toContain('data-level="full"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(
      "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    );
  });

  test("color is strictly driven by server level, not by client-side percentage threshold", () => {
    // 90% but server says 'ok' -> must render ok color
    const htmlOkOverThreshold = renderToStaticMarkup(
      <StorageUsage
        storage={{
          usedBytes: 48318382080,
          quotaBytes: 53687091200,
          percent: 90,
          level: "ok",
          message: null,
        }}
      />,
    );
    expect(htmlOkOverThreshold).toContain("bg-primary");
    expect(htmlOkOverThreshold).not.toContain("bg-warning");
    expect(htmlOkOverThreshold).not.toContain('role="alert"');

    // 50% but server says 'warning' -> must render warning color & warning banner
    const htmlWarningBelowThreshold = renderToStaticMarkup(
      <StorageUsage
        storage={{
          usedBytes: 26843545600,
          quotaBytes: 53687091200,
          percent: 50,
          level: "warning",
          message: "Kapasitas penyimpanan hampir penuh",
        }}
      />,
    );
    expect(htmlWarningBelowThreshold).toContain("bg-warning");
    expect(htmlWarningBelowThreshold).toContain("Kapasitas penyimpanan hampir penuh");
  });

  test("clamps visual progress bar width to 100% while preserving exact percentage text when over quota", () => {
    // Spec 4.5: percent is not clamped and may exceed 100 when quota was reduced below usage
    const storage: StorageView = {
      usedBytes: 64424509440,
      quotaBytes: 53687091200,
      percent: 120,
      level: "full",
      message: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan",
    };

    const html = renderToStaticMarkup(<StorageUsage storage={storage} />);

    // Text and aria-valuenow preserve actual 120%
    expect(html).toContain("120%");
    expect(html).toContain('aria-valuenow="120"');

    // Visual bar is capped at 100% width
    expect(html).toContain("width:100%");
  });

  test("renders loading skeleton pulse state when query is pending", () => {
    const html = renderToStaticMarkup(<StorageUsage state="loading" />);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Memuat kapasitas penyimpanan"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("0%");
  });

  test("renders explicit unavailable state when query settles in error", () => {
    const html = renderToStaticMarkup(<StorageUsage state="error" />);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("Tidak tersedia");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Kapasitas penyimpanan tidak tersedia"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("0%");
  });

  test("renders explicit unavailable state when no storage data is provided", () => {
    const html = renderToStaticMarkup(<StorageUsage storage={null} />);

    expect(html).toContain("Storage Usage");
    expect(html).toContain("Tidak tersedia");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Kapasitas penyimpanan tidak tersedia"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("0%");
  });
});
