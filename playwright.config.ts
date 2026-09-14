import { defineConfig, devices } from "@playwright/test";

/**
 * End to end against the composed stack: the API runs in compose, the built SPA
 * is served by `vite preview`, which proxies to it with the Host kept so the
 * tenant still resolves from the subdomain. technical-specs/04-tech-stack.md 4.7.
 */
export default defineConfig({
  testDir: "e2e",
  // `bun test` collects *.spec.ts and *.test.ts; this suffix keeps browser specs out of it.
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // Chromium resolves *.localhost to loopback, so tenant subdomains need no hosts file.
    baseURL: "http://archiva-demo.localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run --cwd apps/web build && bun run --cwd apps/web preview",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
