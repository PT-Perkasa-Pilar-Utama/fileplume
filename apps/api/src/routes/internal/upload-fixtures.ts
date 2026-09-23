export function pdfFile(name = "test.pdf", content = "test pdf content"): File {
  const bytes = new TextEncoder().encode(`%PDF-1.4\n${content}`);
  return new File([bytes], name, { type: "application/pdf" });
}

export function docxFile(name = "test.docx", content = "docx content"): File {
  const prefix = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const marker = new TextEncoder().encode(`word/document.xml:${content}`);
  const combined = new Uint8Array(prefix.length + marker.length);
  combined.set(prefix, 0);
  combined.set(marker, prefix.length);
  return new File([combined], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function jpgFile(name = "image.jpg"): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  return new File([bytes], name, { type: "image/jpeg" });
}

export function oversizedPdfFile(name = "berkas-25mb.pdf"): File {
  const oversizedBlob = new Blob([new Uint8Array(25 * 1024 * 1024)]);
  const header = new TextEncoder().encode("%PDF-1.4\n");
  const combined = new Blob([header, oversizedBlob]);
  return new File([combined], name, { type: "application/pdf" });
}
