import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const apiServerPort = process.env.IVG_SERVER_PORT ?? "4317";

export default defineConfig({
  server: {
    proxy: {
      "/api": `http://127.0.0.1:${apiServerPort}`,
    },
  },
  build: {
    rollupOptions: {
      input: {
        stage: resolve(rootDir, "index.html"),
        editor: resolve(rootDir, "editor.html"),
        editorV2: resolve(rootDir, "editor-v2.html"),
      },
    },
  },
});
