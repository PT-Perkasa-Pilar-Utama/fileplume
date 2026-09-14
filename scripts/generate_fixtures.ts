import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Produces the QA fixture files the acceptance criteria name.
 *
 * The small PDFs are committed, so their bytes are stable and reviewable, and
 * regenerating them is a no-op: nothing here depends on the clock. The 25 MB
 * file and the EICAR file are written to `fixtures/generated/`, which is
 * ignored, because 25 MB would bloat every clone forever and a committed
 * EICAR file is quarantined on sight by most antivirus.
 */

const ROOT = join(import.meta.dir, "..");
const FIXTURES = join(ROOT, "fixtures");
const GENERATED = join(FIXTURES, "generated");

/** Object 1 is the catalog, 2 the page tree, 3 the font; pages start at 4. */
const FIRST_PAGE_OBJECT = 4;

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * A deliberately plain PDF: one uncompressed text stream per page, so any
 * extractor can read it without a filter it might not implement.
 */
function buildPdf(pages: string[], fillerBytes = 0): Uint8Array {
  const objects: string[] = [];
  const pageObjectId = (index: number) => FIRST_PAGE_OBJECT + index * 2;
  const kids = pages.map((_, index) => `${pageObjectId(index)} 0 R`).join(" ");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const [index, page] of pages.entries()) {
    const body = page
      .split("\n")
      .map((line, lineIndex) => `1 0 0 1 72 ${720 - lineIndex * 18} Tm (${escapeText(line)}) Tj`)
      .join("\n");
    const content = `BT /F1 12 Tf\n${body}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObjectId(index) + 1} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  if (fillerBytes > 0) {
    const filler = "0".repeat(fillerBytes);
    objects.push(`<< /Length ${filler.length} >>\nstream\n${filler}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/** AC-33.01 needs "klausul-kerahasiaan" on page 15, not merely in the file. */
function contractPages(): string[] {
  return Array.from({ length: 16 }, (_, index) => {
    const page = index + 1;
    if (page === 15) {
      return [
        "Pasal 15 - Kerahasiaan",
        "klausul-kerahasiaan",
        "Para pihak sepakat menjaga kerahasiaan seluruh informasi.",
      ].join("\n");
    }
    return [`Kontrak Kerja Sama - Halaman ${page}`, `Pasal ${page} mengenai ketentuan umum.`].join(
      "\n",
    );
  });
}

const FINANCE_PAGES = ["Laporan Keuangan", "Ringkasan posisi keuangan tahun berjalan."];

const COMMITTED: { name: string; pages: string[] }[] = [
  {
    // AC-06.01: content the classifier should file under "Reporting".
    name: "fixture-reporting-01.pdf",
    pages: [
      "Laporan Kinerja Triwulan",
      "Dokumen ini berisi laporan kinerja dan ringkasan metrik operasional.",
    ],
  },
  { name: "kontrak-kerjasama.pdf", pages: contractPages() },
  {
    // AC-03.02: different content, so it must become its own document.
    name: "presentasi-baru.pdf",
    pages: ["Presentasi Baru", "Materi presentasi internal untuk rapat koordinasi."],
  },
  // AC-03.01: this file and its salinan are byte-identical, so the second
  // upload loses on the content hash.
  { name: "laporan-keuangan.pdf", pages: FINANCE_PAGES },
  { name: "laporan-keuangan-salinan.pdf", pages: FINANCE_PAGES },
];

/**
 * Assembled at runtime: a source file holding the whole signature would be
 * quarantined as readily as the fixture it describes.
 */
function eicarSignature(): string {
  return ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR", "-STANDARD-ANTIVIRUS-TEST-FILE!", "$H+H*"].join("");
}

async function main(): Promise<void> {
  await mkdir(FIXTURES, { recursive: true });
  await mkdir(GENERATED, { recursive: true });

  for (const fixture of COMMITTED) {
    await writeFile(join(FIXTURES, fixture.name), buildPdf(fixture.pages));
    console.log(`fixtures/${fixture.name}`);
  }

  // AC-01.06 uploads 25 MB against a 20 MB limit.
  const oversizePages = ["Berkas Besar", "Dokumen uji melebihi batas ukuran."];
  const target = 25 * 1024 * 1024;
  const padding = target - buildPdf(oversizePages).length;
  await writeFile(join(GENERATED, "berkas-25mb.pdf"), buildPdf(oversizePages, padding));
  console.log("fixtures/generated/berkas-25mb.pdf");

  await writeFile(join(GENERATED, "eicar.com"), eicarSignature());
  console.log("fixtures/generated/eicar.com");
}

await main();
