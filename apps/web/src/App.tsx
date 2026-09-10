import { readStoredTheme } from "./lib/theme.ts";

/**
 * The shell is built in FE-S1-01: TanStack Router, TanStack Query, the auth
 * guard and the role-derived navigation. This placeholder exists so the tree
 * is committable and the build gate is real rather than skipped.
 */
export function App() {
  return (
    <main data-theme={readStoredTheme()}>
      <h1>Archiva</h1>
      <p>Scaffold. Lihat docs/TASK_BREAKDOWN.md, kartu FE-S1-01.</p>
    </main>
  );
}
