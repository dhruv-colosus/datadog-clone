#!/usr/bin/env node
import "dotenv/config";
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PROJECT_ROOT = process.cwd();
const STATE_PATH = process.env.DATADOG_STORAGE_STATE_PATH
  ?? path.join(PROJECT_ROOT, ".secrets", "datadog-storageState.json");
const BASE_URL = process.env.DATADOG_BASE_URL ?? "https://app.datadoghq.com";

async function main() {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });

  console.log("Opening a headed Chromium. Log into Datadog manually (incl. 2FA / SSO).");
  console.log(`Target: ${BASE_URL}`);
  console.log("When you can see the Datadog home page, return here and press Enter.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE_URL);

  const rl = readline.createInterface({ input, output });
  await rl.question("Logged in? Press Enter to export cookies > ");
  rl.close();

  const url = page.url();
  if (/\/(account\/login|signin|login)/i.test(url)) {
    console.error(`\n✗ Still on a login page (${url}). Aborting. Re-run when actually logged in.`);
    await browser.close();
    process.exit(1);
  }

  const state = await context.storageState();
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  await browser.close();

  console.log(`\n✓ Wrote ${state.cookies.length} cookies and ${state.origins.length} localStorage origins to:`);
  console.log(`  ${STATE_PATH}`);
  console.log("\nThis file is git-ignored. Treat it as a credential — do not share or commit.");
  console.log("Re-run this script when capture says 'Auth lost: redirected to login'.");
}

main().catch((e) => { console.error(e); process.exit(1); });
