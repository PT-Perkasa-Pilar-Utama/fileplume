export type Theme = "light" | "dark";

const KEY = "archiva.theme";

/**
 * US-36 is client-only. AC-36.02's "tutup browser, buka kembali" is satisfied
 * by localStorage, and the data model has no preference column.
 * api-specs/01-conventions.md 1.14. Card FE-S5-06.
 */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private windows and blocked site data throw on access. Fall through.
  }
  return "light";
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // A theme that cannot be remembered is not a failure worth surfacing.
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
