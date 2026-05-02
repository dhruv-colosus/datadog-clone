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

  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: WEB_URL,
    storageState: "./e2e/.auth/user.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "x-playwright-test": "1",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
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
