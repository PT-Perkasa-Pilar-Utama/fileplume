import type { ErrorDetail } from "./envelope.ts";

/** api-specs/01-conventions.md 1.8. Codes are English and stable; messages are Indonesian. */
export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "Data yang dikirim tidak valid",
  UNAUTHENTICATED: "Sesi Anda telah berakhir. Silakan login kembali",
  SESSION_EXPIRED: "Sesi Anda telah berakhir. Silakan login kembali",
  INVALID_CREDENTIALS: "Email atau password salah",
  FORBIDDEN: "Anda tidak memiliki akses ke halaman ini",
  NOT_OWNER: "Anda hanya dapat mengubah dokumen milik Anda",
  NOT_FOUND: "Data tidak ditemukan",
  PAYLOAD_TOO_LARGE: "Ukuran permintaan terlalu besar",
  RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi nanti",
  INTERNAL_ERROR: "Terjadi kesalahan pada sistem",
  SERVICE_UNAVAILABLE: "Layanan sedang tidak tersedia",
  UNSUPPORTED_TYPE: "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT",
  BATCH_TOO_LARGE: "Maksimal 20 file per unggahan",
  QUOTA_EXCEEDED: "Kapasitas penyimpanan penuh",
  DUPLICATE_CONTENT: "File ini sudah ada di sistem",
  IDENTICAL_CONTENT: "Isi file sama dengan versi yang sudah ada",
  UPLOAD_INTERRUPTED: "Unggahan terputus. Silakan coba lagi",
  MALWARE_DETECTED: "File terdeteksi mengandung malware dan tidak dapat diunggah",
  DOWNLOAD_FORBIDDEN: "Kategori ini tidak diizinkan untuk diunduh",
  TOO_MANY_SELECTED: "Maksimal 50 dokumen per unduhan massal",
  PREVIEW_UNAVAILABLE: "Preview tidak tersedia untuk dokumen ini",
  QUERY_TOO_SHORT: "Masukkan minimal 2 karakter untuk mencari",
  DUPLICATE_NAME: "Kategori dengan nama tersebut sudah ada",
  INVALID_CONFIG_VALUE: "Nilai harus berupa angka",
  NOT_EDITABLE_BY_TENANT: "Parameter ini hanya dapat diubah oleh Super Admin",
  SYSTEM_CATEGORY_IMMUTABLE: "Kategori sistem tidak dapat diubah",
  TOO_MANY_TAGS: "Maksimal 3 tag per dokumen",
  INVALID_STATE_TRANSITION: "Dokumen sedang diproses",
  TENANT_NAME_TAKEN: "Nama organisasi sudah digunakan",
  SUBDOMAIN_TAKEN: "Subdomain sudah digunakan",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_OWNER: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  UNSUPPORTED_TYPE: 422,
  BATCH_TOO_LARGE: 422,
  QUOTA_EXCEEDED: 422,
  DUPLICATE_CONTENT: 409,
  IDENTICAL_CONTENT: 409,
  UPLOAD_INTERRUPTED: 400,
  MALWARE_DETECTED: 422,
  DOWNLOAD_FORBIDDEN: 403,
  TOO_MANY_SELECTED: 422,
  PREVIEW_UNAVAILABLE: 422,
  QUERY_TOO_SHORT: 422,
  DUPLICATE_NAME: 409,
  INVALID_CONFIG_VALUE: 422,
  NOT_EDITABLE_BY_TENANT: 403,
  SYSTEM_CATEGORY_IMMUTABLE: 422,
  TOO_MANY_TAGS: 422,
  INVALID_STATE_TRANSITION: 409,
  TENANT_NAME_TAKEN: 409,
  SUBDOMAIN_TAKEN: 409,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: ErrorDetail[],
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "AppError";
  }
  get status(): number {
    return HTTP_STATUS[this.code];
  }
}
