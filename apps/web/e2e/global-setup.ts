import { request, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? "http://localhost:3000";

const AUTH_DIR = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "user.json");

export default async function globalSetup(_config: FullConfig): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const ctx = await request.newContext({ baseURL: API_URL });
  const res = await ctx.post("/auth/test-login");

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(
      `test-login failed (${res.status()}). Is TEST_AUTH_ENABLED=true on the API? Body: ${body}`,
    );
  }

  await ctx.storageState({ path: AUTH_FILE });
  await ctx.dispose();

  // Playwright uses cookies keyed by URL — remap the API cookie to the web origin too.
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")) as {
    cookies: Array<Record<string, unknown> & { domain: string }>;
    origins: unknown[];
  };
  const webHost = new URL(WEB_URL).hostname;
  for (const c of raw.cookies) {
    if (c.domain === "localhost" || c.domain === "") c.domain = webHost;
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(raw, null, 2));
}
