import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Host is kept, because the API resolves the tenant from its subdomain:
    // open http://archiva-demo.localhost:5173.
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: true },
});
