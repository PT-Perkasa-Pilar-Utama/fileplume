/** api-specs/01-conventions.md 1.1. Resolves to no tenant; Super Admin operations live here. */
export const ADMIN_SUBDOMAIN = "admin";

const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * The single DNS label in front of the base host, or null when the host is
 * not a tenant address: the bare base host, a foreign host, or a nested label.
 */
export function subdomainOf(hostname: string, baseHost: string): string | null {
  const host = hostname.toLowerCase();
  const suffix = `.${baseHost.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return LABEL.test(label) ? label : null;
}
