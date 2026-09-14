import type { extractionMethod, failureReason, processingState } from "../../schema/enums.ts";

export type SeedState = (typeof processingState.enumValues)[number];
export type SeedFailureReason = (typeof failureReason.enumValues)[number];
export type SeedExtraction = (typeof extractionMethod.enumValues)[number];

export type SeedDocument = {
  /** Natural key. Drives the deterministic document id and its content hash. */
  key: string;
  title: string;
  uploaderEmail: string;
  mimeType: string;
  sizeBytes: number;
  state: SeedState;
  /**
   * Days before now. Relative, so the confirmation-window fixtures below stay
   * on the intended side of the boundary every time the seed is rerun.
   */
  ageDays: number;
  failureReason?: SeedFailureReason;
  /** Versions beyond v1, allocated consecutively. AC-21.01 needs one. */
  extraVersions?: number;
  category?: string;
  confirmed?: boolean;
  confidence?: string;
  extraction?: SeedExtraction;
  author?: string;
  tags?: string[];
  /** Page text. Its presence is what gives a document text and page rows. */
  pages?: string[];
};

const PDF = "application/pdf";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ADMIN = "admin@archiva-demo.test";
const KETUA = "ketua@archiva-demo.test";
const ANGGOTA = "anggota@archiva-demo.test";

/**
 * Twenty documents across every processing state. The titles the acceptance
 * criteria name as already present are here so no later card has to invent
 * them; the ones a criterion uploads during its own test are fixture files on
 * disk instead, under `fixtures/`.
 *
 * Every row carries a `blob_key` for bytes that no blob store holds. Seeds
 * write rows only: the reset sequence purges the bucket prefix and recreates
 * the search index after the seed runs (05-module-definitions.md 5.8.2), so
 * anything a seed wrote to either would be destroyed a step later.
 */
export const DEV_DOCUMENTS: SeedDocument[] = [
  {
    key: "laporan.pdf",
    title: "laporan.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 184_320,
    state: "ready",
    ageDays: 30,
    category: "Reporting",
    confirmed: true,
    confidence: "0.910",
    author: "Siti Rahayu",
    tags: ["laporan", "bulanan"],
    pages: [
      "Laporan operasional bulan Maret 2026 untuk PT Archiva Demo.",
      "Ringkasan kinerja tim dan rencana tindak lanjut kuartal berikutnya.",
    ],
  },
  {
    key: "proposal.pdf",
    title: "proposal.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 262_144,
    state: "ready",
    ageDays: 45,
    extraVersions: 1,
    category: "Proposal",
    confirmed: true,
    confidence: "0.880",
    author: "Bagus Pratama",
    tags: ["proposal", "revisi"],
    pages: ["Proposal kerja sama pengadaan sistem arsip digital."],
  },
  {
    key: "technical-proposal-test.pdf",
    title: "technical-proposal-test.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 198_656,
    state: "ready",
    ageDays: 44,
    category: "Proposal",
    confirmed: true,
    confidence: "0.860",
    author: "Bagus Pratama",
    tags: ["proposal", "teknis"],
    pages: ["Spesifikasi teknis pendukung proposal kerja sama."],
  },
  {
    key: "bds-requirement.xlsx",
    title: "bds-requirement.xlsx",
    uploaderEmail: ADMIN,
    mimeType: XLSX,
    sizeBytes: 96_256,
    state: "ready",
    ageDays: 20,
    category: "Reporting",
    confirmed: true,
    confidence: "0.790",
    author: "Dewi Lestari",
    tags: ["kebutuhan"],
    pages: ["Daftar kebutuhan bisnis beserta prioritas dan pemiliknya."],
  },
  {
    key: "laporan-keuangan.pdf",
    title: "laporan-keuangan.pdf",
    uploaderEmail: ADMIN,
    mimeType: PDF,
    sizeBytes: 311_296,
    state: "ready",
    ageDays: 60,
    category: "Keuangan",
    confirmed: true,
    confidence: "0.940",
    author: "Dewi Lestari",
    tags: ["keuangan", "audit"],
    pages: ["Laporan keuangan tahunan yang telah diaudit."],
  },
  {
    key: "notulen-rapat-q1.pdf",
    title: "notulen-rapat-q1.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 73_728,
    state: "ready",
    ageDays: 25,
    category: "Reporting",
    confirmed: true,
    confidence: "0.830",
    author: "Siti Rahayu",
    tags: ["notulen", "rapat"],
    pages: ["Notulen rapat kuartal pertama beserta daftar hadir."],
  },
  {
    key: "sop-pengadaan.pdf",
    title: "sop-pengadaan.pdf",
    uploaderEmail: ADMIN,
    mimeType: PDF,
    sizeBytes: 145_408,
    state: "ready",
    ageDays: 90,
    category: "Kontrak",
    confirmed: true,
    confidence: "0.870",
    author: "Dewi Lestari",
    tags: ["sop", "pengadaan"],
    pages: ["Prosedur operasional standar untuk proses pengadaan barang."],
  },
  {
    key: "invoice-2026-001.pdf",
    title: "invoice-2026-001.pdf",
    uploaderEmail: ADMIN,
    mimeType: PDF,
    sizeBytes: 51_200,
    state: "ready",
    ageDays: 15,
    category: "Keuangan",
    confirmed: true,
    confidence: "0.960",
    extraction: "ocr",
    author: "Dewi Lestari",
    tags: ["invoice", "keuangan"],
    pages: ["Faktur pembayaran nomor INV-2026-001 kepada vendor Alpha."],
  },
  {
    key: "kontrak-vendor-alpha.pdf",
    title: "kontrak-vendor-alpha.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 421_888,
    state: "ready",
    ageDays: 70,
    category: "Kontrak",
    confirmed: true,
    confidence: "0.920",
    author: "Bagus Pratama",
    tags: ["kontrak", "vendor"],
    pages: ["Perjanjian kerja sama dengan vendor Alpha beserta lampirannya."],
  },
  {
    // AC-02.05: unconfirmed and younger than the window, so only its uploader
    // sees it.
    key: "laporan-tahunan-2025.pdf",
    title: "laporan-tahunan-2025.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 532_480,
    state: "ready",
    ageDays: 2,
    category: "Reporting",
    confirmed: false,
    confidence: "0.810",
    author: "Siti Rahayu",
    tags: ["laporan", "tahunan"],
    pages: ["Laporan tahunan 2025 dalam tahap peninjauan."],
  },
  {
    // AC-06.03: the AI could not place it, so it sits in reserved Uncategorized.
    key: "memo-internal.pdf",
    title: "memo-internal.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 40_960,
    state: "ready",
    ageDays: 1,
    category: "Uncategorized",
    confirmed: false,
    confidence: "0.240",
    author: "Siti Rahayu",
    tags: ["memo"],
    pages: ["Memo internal singkat tanpa kategori yang jelas."],
  },
  {
    // AC-02.06: unconfirmed but past the window, so the whole tenant sees it.
    key: "arsip-lama-2019.pdf",
    title: "arsip-lama-2019.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 219_136,
    state: "ready",
    ageDays: 30,
    category: "Reporting",
    confirmed: false,
    confidence: "0.770",
    author: "Bagus Pratama",
    tags: ["arsip"],
    pages: ["Arsip dokumen lama tahun 2019 yang belum dikonfirmasi."],
  },
  {
    key: "draft-kebijakan.pdf",
    title: "draft-kebijakan.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 88_064,
    state: "queued",
    ageDays: 0,
  },
  {
    key: "lampiran-tender.pdf",
    title: "lampiran-tender.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 167_936,
    state: "queued",
    ageDays: 0,
  },
  {
    key: "berkas-audit-2026.pdf",
    title: "berkas-audit-2026.pdf",
    uploaderEmail: ADMIN,
    mimeType: PDF,
    sizeBytes: 655_360,
    state: "processing",
    ageDays: 0,
  },
  {
    key: "proposal-kerjasama-b.pdf",
    title: "proposal-kerjasama-b.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 233_472,
    state: "processing",
    ageDays: 0,
  },
  {
    // AC-44.04 renders "Dokumen terproteksi password".
    key: "dokumen-terproteksi.pdf",
    title: "dokumen-terproteksi.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 102_400,
    state: "failed",
    failureReason: "password_protected",
    ageDays: 5,
  },
  {
    // AC-44.05 renders "Isi dokumen tidak dapat dibaca".
    key: "berkas-rusak.pdf",
    title: "berkas-rusak.pdf",
    uploaderEmail: ANGGOTA,
    mimeType: PDF,
    sizeBytes: 12_288,
    state: "failed",
    failureReason: "unreadable_content",
    ageDays: 6,
  },
  {
    key: "scan-kabur.pdf",
    title: "scan-kabur.pdf",
    uploaderEmail: KETUA,
    mimeType: PDF,
    sizeBytes: 1_048_576,
    state: "failed",
    failureReason: "extraction_timeout",
    ageDays: 7,
  },
  {
    key: "laporan-besar.pdf",
    title: "laporan-besar.pdf",
    uploaderEmail: ADMIN,
    mimeType: PDF,
    sizeBytes: 4_194_304,
    state: "failed",
    failureReason: "index_failed",
    ageDays: 8,
  },
];
