import { chromium } from "@playwright/test";

const API_URL = "http://localhost:8000";
const WEB_URL = "http://localhost:3000";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

// Log in via API.
const apiCtx = await browser.newContext();
const apiPage = await apiCtx.newPage();
const loginRes = await apiPage.request.post(`${API_URL}/auth/login`, {
  data: { email: "costtest@example.com", password: "password123" },
});
if (!loginRes.ok()) {
  const t = await loginRes.text();
  console.error("login failed", loginRes.status(), t);
  process.exit(1);
}

const cookies = await apiCtx.cookies();
const remapped = cookies
  .filter((c) => c.name === "access_token")
  .map((c) => ({ ...c, domain: "localhost" }));
await ctx.addCookies(remapped);

const page = await ctx.newPage();
await page.goto(`${WEB_URL}/cost/explorer`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: "screenshots/cost-explorer.png" });
console.log("saved screenshots/cost-explorer.png");

await browser.close();
