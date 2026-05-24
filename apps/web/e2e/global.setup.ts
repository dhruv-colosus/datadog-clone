/**
 * Setup project — runs once before all specs. Pre-generates per-user
 * storageState files under `e2e/.auth/` so individual specs can launch
 * pre-authenticated browsers.
 *
 * Registered as a Playwright project in `playwright.config.ts`. The default
 * `chromium` project lists `dependencies: ["setup"]` so this runs first.
 *
 * The bootstrap relies on `POST /auth/test-login` which is **gated by
 * `TEST_AUTH_ENABLED=true`** on the API. The criteria forbids public
 * backdoor login routes; this one returns 404 unless the env var is
 * explicitly flipped on (default `false` per `.env.example`). The
 * `webServer` block in `playwright.config.ts` sets it to `true` when
 * Playwright owns the api process. For specs run against a docker stack,
 * set `TEST_AUTH_ENABLED=true` on the api container or seed real creds
 * and convert this file to `POST /auth/login`.
 */
import { request, test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? "http://localhost:3000";

const AUTH_DIR = path.join(__dirname, ".auth");
const ADMIN_AUTH_FILE = path.join(AUTH_DIR, "admin.json");
const USER_AUTH_FILE = path.join(AUTH_DIR, "user.json");

const SEED_USERS = [
  { storagePath: ADMIN_AUTH_FILE, label: "admin" },
  { storagePath: USER_AUTH_FILE, label: "user" },
];

setup("authenticate seed users", async () => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const { storagePath, label } of SEED_USERS) {
    const ctx = await request.newContext({
      baseURL: API_URL,
      ignoreHTTPSErrors: true,
    });

    const res = await ctx.post("/auth/test-login");
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(
        `[${label}] test-login failed (${res.status()}). Is TEST_AUTH_ENABLED=true on the API? Body: ${body}`,
      );
    }

    await ctx.storageState({ path: storagePath });
    await ctx.dispose();

    // Playwright keys cookies by origin. The cookie above lands on the API
    // origin; remap to the web origin so specs running against the web app
    // pick it up.
    const raw = JSON.parse(fs.readFileSync(storagePath, "utf8")) as {
      cookies: Array<Record<string, unknown> & { domain: string }>;
      origins: unknown[];
    };
    const webHost = new URL(WEB_URL).hostname;
    for (const c of raw.cookies) {
      if (c.domain === "localhost" || c.domain === "") c.domain = webHost;
    }
    fs.writeFileSync(storagePath, JSON.stringify(raw, null, 2));
  }
});
