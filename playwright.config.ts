import { defineConfig, devices } from "@playwright/test";

// E2E runs against a development kintone environment. Not run in CI.
// The Firefox project exercises the route-B clipboard fallback (TC-37).
export default defineConfig({
  testDir: "./test/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.KINTONE_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
