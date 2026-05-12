import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "chromium",
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: {
      width: 1280,
      height: 720,
    },
  },
  webServer: [
    {
      command:
        "powershell -NoProfile -Command \"$dir = Join-Path $env:TEMP 'ivg-playwright-data'; Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue; $env:IVG_DATA_DIR = $dir; npm run server:dev\"",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:4317/api/health",
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: "http://127.0.0.1:5173",
    },
  ],
});
