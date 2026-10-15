import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const backend = process.env.API_PROXY_TARGET || "http://127.0.0.1:8080";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: backend, changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { "/api": { target: backend, changeOrigin: true } },
  },
});
