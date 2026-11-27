import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: "./tests/full-stack",
  // Share a disposable API; avoid concurrent SQLite writes and quota races.
  workers: 1,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: "http://127.0.0.1:4331",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "uv run --package app python scripts/e2e-api.py",
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      url: "http://127.0.0.1:8765/api/user",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
    {
      command:
        "npm run build && node --import ../scripts/e2e-providers.mjs dist/server/entry.mjs",
      env: { HOST: "127.0.0.1", PORT: "4331", GEOCODING_PROVIDER: "photon" },
      url: "http://127.0.0.1:4331/audio",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});
