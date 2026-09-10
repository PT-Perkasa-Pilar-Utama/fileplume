import { z } from "zod";

/** api-specs/01-conventions.md 1.4, 1.5, 1.6. One envelope, defined once. */
export const metaSchema = z.object({
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  total: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  message: z.string().nullish(),
  notice: z.string().nullish(),
});

export const dataOf = <T extends z.ZodTypeAny>(inner: T) => z.object({ data: inner });

export const collectionOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), meta: metaSchema });

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), issue: z.string() })).optional(),
  }),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/** api-specs/01-conventions.md 1.5.1. Empty is a success, and the copy is contract. */
export const EMPTY_STATE = {
  SEARCH_NO_RESULT: "Tidak ada hasil yang ditemukan",
  NO_DOCUMENTS: "Belum ada dokumen. Seret file ke area unggah untuk memulai",
  NO_DOCUMENTS_IN_CATEGORY: "Tidak ada dokumen pada kategori ini",
  NO_DOCUMENTS_FOR_TAGS: "Tidak ada dokumen dengan kombinasi tag ini",
  DOCUMENT_NOT_FOUND: "Dokumen tidak ditemukan",
  NO_RELATED: "Tidak ada dokumen terkait",
  NO_AUDIT: "Belum ada aktivitas tercatat",
  NO_ANALYTICS: "Belum ada aktivitas untuk ditampilkan",
  NO_UNCONFIRMED: "Tidak ada dokumen menunggu kategori",
  INDEXING_IN_FLIGHT: "Sebagian dokumen masih diproses dan belum dapat dicari",
} as const;
