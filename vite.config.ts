import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4317",
    },
  },
  build: {
    rollupOptions: {
      input: {
        stage: resolve(rootDir, "index.html"),
        editor: resolve(rootDir, "editor.html"),
      },
    },
  },
});
