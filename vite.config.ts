import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  publicDir: "../../assets",
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:18082",
      "/media": "http://127.0.0.1:18082",
    },
  },
});
