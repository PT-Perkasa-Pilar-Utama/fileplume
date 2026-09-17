import { create } from "zustand";
import { applyTheme, readStoredTheme, storeTheme, type Theme } from "./theme.ts";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme: Theme) => {
    storeTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === "light" ? "dark" : "light";
      storeTheme(nextTheme);
      applyTheme(nextTheme);
      return { theme: nextTheme };
    });
  },
}));
