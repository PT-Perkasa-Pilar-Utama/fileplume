import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Host is kept, because the API resolves the tenant from its subdomain:
// open http://archiva-demo.localhost:5173. Paths mirror the Caddyfile.
const api = { target: "http://localhost:3000", changeOrigin: false };
const proxy = { "/api": api, "/health/live": api };

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // host:true binds 0.0.0.0 and :: so *.localhost reaches the server over
  // IPv4 too. The default binds [::1] only, and Node's request stack dials
  // 127.0.0.1 for tenant subdomains, which then fails with ECONNREFUSED
  // while Chromium (which prefers ::1) still works.
  server: { port: 5173, host: true, proxy },
  // Playwright serves the built SPA here. playwright.config.ts.
  preview: { port: 4173, strictPort: true, host: true, proxy },
  build: { outDir: "dist", sourcemap: true },
});
