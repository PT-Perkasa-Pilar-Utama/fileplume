import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Host is kept, because the API resolves the tenant from its subdomain:
// open http://archiva-demo.localhost:5173. Paths mirror the Caddyfile.
const api = { target: "http://localhost:3000", changeOrigin: false };
const proxy = { "/api": api, "/health/live": api };

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { port: 5173, proxy },
  // Playwright serves the built SPA here. playwright.config.ts.
  preview: { port: 4173, strictPort: true, proxy },
  build: { outDir: "dist", sourcemap: true },
});
