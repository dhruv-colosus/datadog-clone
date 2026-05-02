import { Sandbox } from "@e2b/desktop";
import { chromium, type Browser, type BrowserContext, type Page, type Request, type Response } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { assertAllowedUrl, assertReadOnlyEval, installNetworkGuards } from "./safety.js";

interface StartOptions {
  storageStatePath: string;
  baseUrl: string;
  runId: string;
  capturesRoot: string;
}

interface HarEntry {
  startedAt: string;
  endedAt?: string;
  request: { method: string; url: string; headers: Record<string, string> };
  response?: { status: number; statusText: string; headers: Record<string, string>; mimeType: string; bodySize: number };
}

interface HarRecording { screenId: string; entries: HarEntry[]; offCallbacks: Array<() => void>; }

const CDP_PORT = 9222;
const CHROME_USER_DATA = "/tmp/dd-chrome-profile";
const STORAGE_STATE_REMOTE = "/tmp/dd-storage-state.json";

const CHROME_LAUNCH_FLAGS = [
  `--remote-debugging-port=${CDP_PORT}`,
  "--remote-debugging-address=0.0.0.0",
  "--remote-allow-origins=*",
  `--user-data-dir=${CHROME_USER_DATA}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-features=Translate,OptimizationGuideModelDownloading",
  "--disable-default-apps",
  "--start-maximized",
];

export class CaptureSandbox {
  private desktop?: Sandbox;
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private currentHar: HarRecording | null = null;
  private opts!: StartOptions;
  private screenStepCounts = new Map<string, number>();

  async start(opts: StartOptions): Promise<{ sandboxId: string; cdpUrl: string }> {
    this.opts = opts;
    const stateRaw = await fs.readFile(opts.storageStatePath, "utf8");
    const storageState = JSON.parse(stateRaw);

    this.desktop = await Sandbox.create();
    await this.desktop.files.write(STORAGE_STATE_REMOTE, stateRaw);

    const cmd = `google-chrome ${CHROME_LAUNCH_FLAGS.join(" ")} about:blank`;
    this.desktop.commands.run(cmd, { background: true } as any);

    const host = this.desktop.getHost(CDP_PORT);
    const cdpUrl = host.startsWith("http") ? host : `https://${host}`;
    await this.waitForCdpReady(cdpUrl);

    this.browser = await chromium.connectOverCDP(cdpUrl);
    const contexts = this.browser.contexts();
    this.context = contexts[0] ?? (await this.browser.newContext());

    if (Array.isArray(storageState.cookies)) {
      await this.context.addCookies(storageState.cookies);
    }

    const pages = this.context.pages();
    this.page = pages[0] ?? (await this.context.newPage());

    await installNetworkGuards(this.page);

    if (Array.isArray(storageState.origins)) {
      for (const origin of storageState.origins) {
        if (!origin.origin) continue;
        try {
          await this.page.goto(origin.origin, { waitUntil: "domcontentloaded", timeout: 30_000 });
          await this.page.evaluate((items: Array<{ name: string; value: string }>) => {
            for (const it of items) {
              try { localStorage.setItem(it.name, it.value); } catch {}
            }
          }, origin.localStorage ?? []);
        } catch {}
      }
    }

    await this.page.setViewportSize({ width: 1440, height: 900 });
    return { sandboxId: this.desktop.sandboxId, cdpUrl };
  }

  private async waitForCdpReady(cdpUrl: string): Promise<void> {
    const deadline = Date.now() + 60_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${cdpUrl}/json/version`);
        if (res.ok) return;
      } catch (e) { lastError = e; }
      await sleep(1000);
    }
    throw new Error(`CDP not ready at ${cdpUrl} after 60s: ${String(lastError)}`);
  }

  private requirePage(): Page {
    if (!this.page) throw new Error("Sandbox not started; call start_session first");
    return this.page;
  }

  private screenDir(screenId: string): string {
    return path.join(this.opts.capturesRoot, this.opts.runId, "screens", screenId);
  }

  private async ensureScreenDir(screenId: string): Promise<string> {
    const dir = this.screenDir(screenId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  bumpStep(screenId: string): number {
    const n = (this.screenStepCounts.get(screenId) ?? 0) + 1;
    this.screenStepCounts.set(screenId, n);
    return n;
  }

  getStepCount(screenId: string): number {
    return this.screenStepCounts.get(screenId) ?? 0;
  }

  async resolveTargetUrl(rawUrl: string): Promise<string> {
    const baseUrl = this.opts.baseUrl.replace(/\/+$/, "");
    const full = rawUrl.startsWith("http") ? rawUrl : `${baseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
    assertAllowedUrl(full);
    return full;
  }

  async navigate(url: string): Promise<{ finalUrl: string; title: string; status: number | null }> {
    const page = this.requirePage();
    const target = await this.resolveTargetUrl(url);
    const resp = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    if (/\/(account\/login|signin|login)/i.test(page.url())) {
      throw new Error(`Auth lost: redirected to login (${page.url()}). Re-export storageState.`);
    }
    return { finalUrl: page.url(), title: await page.title(), status: resp?.status() ?? null };
  }

  async screenshot(screenId: string, label: string = "default", fullPage = false): Promise<string> {
    const page = this.requirePage();
    const dir = await this.ensureScreenDir(screenId);
    const safeLabel = label.replace(/[^a-z0-9-]/gi, "-");
    const file = path.join(dir, `screenshot-${safeLabel}.png`);
    await page.screenshot({ path: file, fullPage });
    return path.relative(process.cwd(), file);
  }

  async click(args: { x?: number; y?: number; selector?: string; screenId: string; label?: string }): Promise<{ screenshotPath: string }> {
    const page = this.requirePage();
    if (args.selector) {
      await page.locator(args.selector).first().click({ timeout: 10_000 });
    } else if (args.x !== undefined && args.y !== undefined) {
      await page.mouse.click(args.x, args.y);
    } else {
      throw new Error("click requires either selector or {x,y}");
    }
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    const screenshotPath = await this.screenshot(args.screenId, args.label ?? `click-${this.bumpStep(args.screenId)}`);
    return { screenshotPath };
  }

  async hover(args: { x?: number; y?: number; selector?: string; screenId: string; label?: string }): Promise<{ screenshotPath: string }> {
    const page = this.requirePage();
    if (args.selector) {
      await page.locator(args.selector).first().hover({ timeout: 10_000 });
    } else if (args.x !== undefined && args.y !== undefined) {
      await page.mouse.move(args.x, args.y);
    } else {
      throw new Error("hover requires either selector or {x,y}");
    }
    await sleep(400);
    const screenshotPath = await this.screenshot(args.screenId, args.label ?? `hover-${this.bumpStep(args.screenId)}`);
    return { screenshotPath };
  }

  async type(args: { text: string; selector?: string }): Promise<void> {
    const page = this.requirePage();
    if (args.selector) {
      await page.locator(args.selector).first().fill(args.text, { timeout: 10_000 });
    } else {
      await page.keyboard.type(args.text, { delay: 20 });
    }
  }

  async key(keys: string | string[]): Promise<void> {
    const page = this.requirePage();
    const combo = Array.isArray(keys) ? keys.join("+") : keys;
    await page.keyboard.press(combo);
  }

  async scroll(args: { dy: number; selector?: string }): Promise<void> {
    const page = this.requirePage();
    if (args.selector) {
      await page.locator(args.selector).first().evaluate((el, dy) => { (el as HTMLElement).scrollBy(0, dy); }, args.dy);
    } else {
      await page.mouse.wheel(0, args.dy);
    }
    await sleep(300);
  }

  async dumpDom(screenId: string): Promise<string> {
    const page = this.requirePage();
    const dir = await this.ensureScreenDir(screenId);
    const file = path.join(dir, "dom.html");
    const html = await page.content();
    await fs.writeFile(file, html, "utf8");
    return path.relative(process.cwd(), file);
  }

  async dumpA11y(screenId: string): Promise<string> {
    const page = this.requirePage();
    const dir = await this.ensureScreenDir(screenId);
    const file = path.join(dir, "accessibility-tree.json");
    const tree = await page.accessibility.snapshot({ interestingOnly: false });
    await fs.writeFile(file, JSON.stringify(tree, null, 2), "utf8");
    return path.relative(process.cwd(), file);
  }

  async evalJs(script: string): Promise<unknown> {
    const page = this.requirePage();
    assertReadOnlyEval(script);
    return await page.evaluate(`(() => { ${script} })()`);
  }

  async startHar(screenId: string): Promise<void> {
    const page = this.requirePage();
    if (this.currentHar) await this.stopHar(this.currentHar.screenId);

    const entries: HarEntry[] = [];
    const startMap = new Map<Request, number>();

    const onRequest = (req: Request) => {
      startMap.set(req, Date.now());
      entries.push({
        startedAt: new Date().toISOString(),
        request: { method: req.method(), url: req.url(), headers: req.headers() },
      });
    };
    const onResponse = async (res: Response) => {
      const entry = entries.find((e) => e.request.url === res.url() && !e.response);
      if (!entry) return;
      let bodySize = 0;
      try { const buf = await res.body(); bodySize = buf.byteLength; } catch {}
      entry.endedAt = new Date().toISOString();
      entry.response = {
        status: res.status(),
        statusText: res.statusText(),
        headers: res.headers(),
        mimeType: res.headers()["content-type"] ?? "",
        bodySize,
      };
    };
    page.on("request", onRequest);
    page.on("response", onResponse);
    this.currentHar = {
      screenId,
      entries,
      offCallbacks: [
        () => page.off("request", onRequest),
        () => page.off("response", onResponse),
      ],
    };
  }

  async stopHar(screenId: string): Promise<string | null> {
    if (!this.currentHar || this.currentHar.screenId !== screenId) return null;
    for (const off of this.currentHar.offCallbacks) off();
    const dir = await this.ensureScreenDir(screenId);
    const file = path.join(dir, "network.har");
    const har = {
      log: {
        version: "1.2",
        creator: { name: "capture-agent", version: "0.0.1" },
        entries: this.currentHar.entries.map((e) => ({
          startedDateTime: e.startedAt,
          time: e.endedAt && e.startedAt ? new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime() : 0,
          request: { method: e.request.method, url: e.request.url, httpVersion: "HTTP/1.1", headers: Object.entries(e.request.headers).map(([n, v]) => ({ name: n, value: v })), queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
          response: e.response ? { status: e.response.status, statusText: e.response.statusText, httpVersion: "HTTP/1.1", headers: Object.entries(e.response.headers).map(([n, v]) => ({ name: n, value: v })), cookies: [], content: { size: e.response.bodySize, mimeType: e.response.mimeType }, redirectURL: "", headersSize: -1, bodySize: e.response.bodySize } : { status: 0, statusText: "", httpVersion: "", headers: [], cookies: [], content: { size: 0, mimeType: "" }, redirectURL: "", headersSize: -1, bodySize: -1 },
          cache: {},
          timings: { send: 0, wait: 0, receive: 0 },
        })),
      },
    };
    await fs.writeFile(file, JSON.stringify(har, null, 2), "utf8");
    this.currentHar = null;
    return path.relative(process.cwd(), file);
  }

  async writeMetadata(screenId: string, data: Record<string, unknown>): Promise<string> {
    const dir = await this.ensureScreenDir(screenId);
    const file = path.join(dir, "metadata.json");
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return path.relative(process.cwd(), file);
  }

  async writeNarration(screenId: string, content: string): Promise<string> {
    const dir = await this.ensureScreenDir(screenId);
    const file = path.join(dir, "narration.md");
    await fs.writeFile(file, content, "utf8");
    return path.relative(process.cwd(), file);
  }

  pageUrl(): string {
    return this.requirePage().url();
  }

  async pageTitle(): Promise<string> {
    return this.requirePage().title();
  }

  async kill(): Promise<void> {
    try { if (this.currentHar) await this.stopHar(this.currentHar.screenId); } catch {}
    try { await this.browser?.close(); } catch {}
    try { await this.desktop?.kill(); } catch {}
  }
}
