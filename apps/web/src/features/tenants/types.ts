import { z } from "zod";

/**
 * Validasi form tambah tenant di client-side.
 * Aturan subdomain mengikuti aturan server di api-specs/03-tenants.md 3.1:
 * - 3 sampai 63 karakter
 * - Karakter huruf kecil, angka, dan hyphen
 * - Tanpa hyphen di awal maupun di akhir
 */
export const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const createTenantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama organisasi wajib diisi")
    .max(200, "Nama organisasi maksimal 200 karakter"),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Subdomain minimal 3 karakter")
    .max(63, "Subdomain maksimal 63 karakter")
    .regex(
      SUBDOMAIN_REGEX,
      "Subdomain hanya boleh berisi huruf kecil, angka, dan tanda hubung, tanpa diawali atau diakhiri tanda hubung",
    ),
});

export type CreateTenantFormInput = z.infer<typeof createTenantFormSchema>;
