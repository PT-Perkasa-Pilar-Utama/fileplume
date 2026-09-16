import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useThemeStore } from "./theme-store.ts";

interface MockStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  clear: () => void;
}

interface MockDocElement {
  setAttribute: (key: string, val: string) => void;
  getAttribute: (key: string) => string | null;
  classList: {
    add: (c: string) => void;
    remove: (c: string) => void;
    contains: (c: string) => boolean;
  };
}

describe("useThemeStore", () => {
  let storage: Record<string, string> = {};
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

  beforeEach(() => {
    storage = {};
    const mockStorage: MockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      clear: () => {
        storage = {};
      },
    };

    const attributes: Record<string, string> = {};
    const classes = new Set<string>();

    const mockDocElement: MockDocElement = {
      setAttribute: (key: string, val: string) => {
        attributes[key] = val;
      },
      getAttribute: (key: string) => attributes[key] ?? null,
      classList: {
        add: (c: string) => {
          classes.add(c);
        },
        remove: (c: string) => {
          classes.delete(c);
        },
        contains: (c: string) => classes.has(c),
      },
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "document", {
      value: { documentElement: mockDocElement },
      configurable: true,
      writable: true,
    });

    useThemeStore.setState({ theme: "light" });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }

    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  });

  test("initial theme is light", () => {
    expect(useThemeStore.getState().theme).toBe("light");
  });

  test("setTheme updates theme", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  test("toggleTheme toggles between light and dark", () => {
    expect(useThemeStore.getState().theme).toBe("light");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });
});
