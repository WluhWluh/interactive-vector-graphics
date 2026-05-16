import { defineConfig } from "@playwright/test";

const clientPort = Number(process.env.IVG_PLAYWRIGHT_CLIENT_PORT ?? 5173);
const serverPort = Number(process.env.IVG_PLAYWRIGHT_SERVER_PORT ?? 4317);
const host = "127.0.0.1";
const dataDirName =
  process.env.IVG_PLAYWRIGHT_DATA_DIR_NAME ??
  (serverPort === 4317 ? "ivg-playwright-data" : `ivg-playwright-data-${serverPort}`);

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  use: {
    baseURL: `http://${host}:${clientPort}`,
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
        `powershell -NoProfile -Command "$dir = Join-Path $env:TEMP '${dataDirName}'; Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue; $env:IVG_DATA_DIR = $dir; $env:IVG_SERVER_PORT = '${serverPort}'; npm.cmd run server:dev"`,
      reuseExistingServer: false,
      timeout: 30_000,
      url: `http://${host}:${serverPort}/api/health`,
    },
    {
      command: `powershell -NoProfile -Command "$env:IVG_SERVER_PORT = '${serverPort}'; npm.cmd run dev -- --host ${host} --port ${clientPort}"`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: `http://${host}:${clientPort}`,
    },
  ],
});
