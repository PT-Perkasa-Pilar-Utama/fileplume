import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type JSX, useEffect } from "react";
import { queryClient } from "./lib/query-client.ts";
import { applyTheme, readStoredTheme } from "./lib/theme.ts";
import { useThemeStore } from "./lib/theme-store.ts";
import { router } from "./routes/router.tsx";

export function App(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
