import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyTheme, readStoredTheme, storeTheme } from "./theme.ts";

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

describe("theme helper", () => {
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

  test("defaults to light theme when nothing is stored", () => {
    expect(readStoredTheme()).toBe("light");
  });

  test("reads dark theme when stored", () => {
    storeTheme("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  test("stores and retrieves light theme", () => {
    storeTheme("light");
    expect(readStoredTheme()).toBe("light");
  });

  test("applyTheme sets data-theme attribute on document root", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
