import { customType } from "drizzle-orm/pg-core";

/**
 * drizzle-orm has no built-in citext column. api-specs/02-authentication.md,
 * 03-tenants.md and 07-enrichment.md rely on case-insensitive comparison "at
 * rest" for email, subdomain and tags, so this is a real column type, not a
 * text column with an app-layer lower() workaround. Requires the citext
 * extension, enabled by the first migration in the ledger.
 */
export const citext = customType<{ data: string }>({
  dataType: () => "citext",
});
