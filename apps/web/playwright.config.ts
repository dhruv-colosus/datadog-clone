// Required by the universal acceptance checklist (§5a). Node's fetch rejects
// the local CA used by the clone-apps gateway; setting this off lets specs
// hit https://<app>.clone.test without bundling a CA into the test runner.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { defineConfig, devices } from "@playwright/test";
import path from "path";

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? "http://localhost:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const REPO_ROOT = path.resolve(__dirname, "../..");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "x-playwright-test": "1",
    },
  },

  projects: [
    // Bootstrap project — runs first, pre-generates `e2e/.auth/*.json`.
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      command: "pnpm dev:api",
      cwd: REPO_ROOT,
      url: `${API_URL}/docs`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        TEST_AUTH_ENABLED: "true",
      },
    },
    {
      command: "pnpm dev:web",
      cwd: REPO_ROOT,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
      },
    },
  ],
});
