#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import path from "node:path";
import { promises as fs } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { CaptureSandbox } from "./sandbox.js";
import type { RunManifest, ScreenManifestEntry, ScreenStatus } from "./types.js";
import { renderRunReports, writeManifest } from "./report-writer.js";

const PROJECT_ROOT = process.env.CAPTURE_PROJECT_ROOT ?? process.cwd();
const CAPTURES_ROOT = path.join(PROJECT_ROOT, "research", "captures");
const REPORTS_ROOT = path.join(PROJECT_ROOT, "research", "reports");
const STORAGE_STATE_PATH = process.env.DATADOG_STORAGE_STATE_PATH
  ?? path.join(PROJECT_ROOT, ".secrets", "datadog-storageState.json");
const DEFAULT_BASE_URL = process.env.DATADOG_BASE_URL ?? "https://app.datadoghq.com";

class ManifestTracker {
  manifest: RunManifest;
  constructor(runId: string, baseUrl: string) {
    this.manifest = { run_id: runId, base_url: baseUrl, started_at: nowIso(), screens: [] };
  }
  upsert(id: string, partial: Partial<ScreenManifestEntry> & { name?: string; url?: string }): ScreenManifestEntry {
    let entry = this.manifest.screens.find((s) => s.id === id);
    if (!entry) {
      entry = {
        id, name: partial.name ?? id, url: partial.url ?? "",
        status: "partial", steps_used: 0, artifacts: [],
        started_at: nowIso(), ended_at: nowIso(),
      };
      this.manifest.screens.push(entry);
    }
    Object.assign(entry, partial, { ended_at: nowIso() });
    return entry;
  }
  addArtifact(id: string, p: string): void {
    const e = this.upsert(id, {});
    if (!e.artifacts.includes(p)) e.artifacts.push(p);
  }
  setStatus(id: string, status: ScreenStatus, error?: string): void {
    this.upsert(id, { status, error });
  }
}

const nowIso = () => new Date().toISOString();
let sandbox: CaptureSandbox | null = null;
let tracker: ManifestTracker | null = null;
let runId: string | null = null;

const StartSessionArgs = z.object({
  run_id: z.string().optional(),
  base_url: z.string().optional(),
  storage_state_path: z.string().optional(),
});

const ScreenIdOnly = z.object({ screen_id: z.string() });

const NavigateArgs = z.object({ url: z.string(), screen_id: z.string().optional() });

const ScreenshotArgs = z.object({
  screen_id: z.string(),
  label: z.string().optional(),
  full_page: z.boolean().optional(),
});

const PointerArgs = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  selector: z.string().optional(),
  screen_id: z.string(),
  label: z.string().optional(),
});

const TypeArgs = z.object({ text: z.string(), selector: z.string().optional() });
const KeyArgs = z.object({ keys: z.union([z.string(), z.array(z.string())]) });
const ScrollArgs = z.object({ dy: z.number(), selector: z.string().optional() });
const WaitArgs = z.object({ seconds: z.number().min(0).max(30) });
const EvalArgs = z.object({ script: z.string() });
const NarrationArgs = z.object({ screen_id: z.string(), content: z.string() });
const MetadataArgs = z.object({ screen_id: z.string(), metadata: z.record(z.unknown()) });
const MarkScreenArgs = z.object({
  screen_id: z.string(),
  status: z.enum(["captured", "partial", "aborted_unsafe", "error"]),
  error: z.string().optional(),
  steps_used: z.number().int().nonnegative().optional(),
});

const tools = [
  {
    name: "start_session",
    description: "Boot the E2B Desktop sandbox, launch Chromium with remote debugging, attach Playwright via CDP, and load the Datadog storage state. Must be called before any other tool. Idempotent within a process.",
    inputSchema: { type: "object", properties: { run_id: { type: "string" }, base_url: { type: "string" }, storage_state_path: { type: "string" } } },
  },
  {
    name: "navigate",
    description: "Navigate to a Datadog URL (absolute or relative to base_url). Returns final URL, page title, status code. Throws if redirected to login (cookies expired) or URL is not in the allowlist.",
    inputSchema: { type: "object", required: ["url"], properties: { url: { type: "string" }, screen_id: { type: "string" } } },
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the current page and save it under research/captures/<run-id>/screens/<screen-id>/. Returns the relative path to the saved PNG.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { screen_id: { type: "string" }, label: { type: "string", description: "Short kebab-case label for the state, e.g. 'default' or 'panel-open'." }, full_page: { type: "boolean" } } },
  },
  {
    name: "click",
    description: "Click an element. Provide either a CSS selector or {x, y} viewport coordinates. Always re-screenshots after the click and returns the new screenshot path.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { x: { type: "number" }, y: { type: "number" }, selector: { type: "string" }, screen_id: { type: "string" }, label: { type: "string" } } },
  },
  {
    name: "hover",
    description: "Hover over an element (selector or {x, y}). Re-screenshots after.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { x: { type: "number" }, y: { type: "number" }, selector: { type: "string" }, screen_id: { type: "string" }, label: { type: "string" } } },
  },
  {
    name: "type",
    description: "Type text into the focused element, or into an element matched by `selector`. Use for search/filter inputs only — never for save forms.",
    inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, selector: { type: "string" } } },
  },
  {
    name: "key",
    description: "Press a key or chord. Pass either a single key like 'Enter', 'Escape', 'Meta+K' or an array like ['Control', 'K'].",
    inputSchema: { type: "object", required: ["keys"], properties: { keys: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] } } },
  },
  {
    name: "scroll",
    description: "Scroll the page (dy positive = down). Optional selector scopes the scroll to a specific element.",
    inputSchema: { type: "object", required: ["dy"], properties: { dy: { type: "number" }, selector: { type: "string" } } },
  },
  {
    name: "wait",
    description: "Pause for `seconds` seconds. Use sparingly — prefer relying on Playwright's built-in waits. Max 30s.",
    inputSchema: { type: "object", required: ["seconds"], properties: { seconds: { type: "number", minimum: 0, maximum: 30 } } },
  },
  {
    name: "dump_dom",
    description: "Save the current page's outerHTML to research/captures/<run-id>/screens/<screen-id>/dom.html.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { screen_id: { type: "string" } } },
  },
  {
    name: "dump_a11y",
    description: "Save the accessibility tree as JSON.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { screen_id: { type: "string" } } },
  },
  {
    name: "start_har",
    description: "Begin recording network activity for the given screen. One HAR can be active at a time per session — calling start_har again auto-stops the previous one.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { screen_id: { type: "string" } } },
  },
  {
    name: "stop_har",
    description: "Stop the active HAR recording and write network.har for the screen.",
    inputSchema: { type: "object", required: ["screen_id"], properties: { screen_id: { type: "string" } } },
  },
  {
    name: "eval_js",
    description: "Evaluate a JS expression in the page context. Returns the result. The expression body is wrapped in a function call. Read-only: scripts containing fetch, XMLHttpRequest, sendBeacon, or location/cookie assignment are rejected.",
    inputSchema: { type: "object", required: ["script"], properties: { script: { type: "string" } } },
  },
  {
    name: "write_narration",
    description: "Write narration.md for a screen. Pass the markdown content; it lands at research/captures/<run-id>/screens/<screen-id>/narration.md.",
    inputSchema: { type: "object", required: ["screen_id", "content"], properties: { screen_id: { type: "string" }, content: { type: "string" } } },
  },
  {
    name: "write_metadata",
    description: "Write metadata.json for a screen (url, title, viewport, observed states, anything else worth recording).",
    inputSchema: { type: "object", required: ["screen_id", "metadata"], properties: { screen_id: { type: "string" }, metadata: { type: "object" } } },
  },
  {
    name: "mark_screen",
    description: "Update the screen's status in the run manifest. Call when done with a screen (status='captured') or aborting it.",
    inputSchema: { type: "object", required: ["screen_id", "status"], properties: { screen_id: { type: "string" }, status: { type: "string", enum: ["captured", "partial", "aborted_unsafe", "error"] }, error: { type: "string" }, steps_used: { type: "number" } } },
  },
  {
    name: "end_session",
    description: "Finalize manifest.json, render per-screen reports + index.md, and tear down the sandbox. Returns paths to manifest and report index.",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server({ name: "capture-mcp", version: "0.0.1" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const result = await dispatch(name, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}` : String(e);
    return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }], isError: true };
  }
});

function requireSandbox(): CaptureSandbox {
  if (!sandbox) throw new Error("call start_session first");
  return sandbox;
}
function requireTracker(): ManifestTracker {
  if (!tracker) throw new Error("call start_session first");
  return tracker;
}

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "start_session": {
      const a = StartSessionArgs.parse(args);
      if (sandbox) return { sandbox_id: (sandbox as any).desktop?.sandboxId, run_id: runId, note: "already started" };
      runId = a.run_id ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const baseUrl = a.base_url ?? DEFAULT_BASE_URL;
      const storageState = a.storage_state_path ?? STORAGE_STATE_PATH;
      try { await fs.access(storageState); }
      catch { throw new Error(`storageState not found at ${storageState}. Run 'node scripts/auth/export-datadog-cookies.mjs' first.`); }

      sandbox = new CaptureSandbox();
      tracker = new ManifestTracker(runId, baseUrl);
      const { sandboxId, cdpUrl } = await sandbox.start({
        storageStatePath: storageState,
        baseUrl,
        runId,
        capturesRoot: CAPTURES_ROOT,
      });
      tracker.manifest.sandbox_id = sandboxId;
      await fs.mkdir(path.join(CAPTURES_ROOT, runId), { recursive: true });
      return { run_id: runId, sandbox_id: sandboxId, cdp_url: cdpUrl, base_url: baseUrl, captures_root: CAPTURES_ROOT };
    }
    case "navigate": {
      const a = NavigateArgs.parse(args);
      const sb = requireSandbox();
      const r = await sb.navigate(a.url);
      if (a.screen_id) requireTracker().upsert(a.screen_id, { url: r.finalUrl });
      return r;
    }
    case "screenshot": {
      const a = ScreenshotArgs.parse(args);
      const sb = requireSandbox();
      const p = await sb.screenshot(a.screen_id, a.label, a.full_page ?? false);
      requireTracker().addArtifact(a.screen_id, p);
      return { path: p };
    }
    case "click": {
      const a = PointerArgs.parse(args);
      const sb = requireSandbox();
      const r = await sb.click(a);
      requireTracker().addArtifact(a.screen_id, r.screenshotPath);
      return r;
    }
    case "hover": {
      const a = PointerArgs.parse(args);
      const sb = requireSandbox();
      const r = await sb.hover(a);
      requireTracker().addArtifact(a.screen_id, r.screenshotPath);
      return r;
    }
    case "type": {
      const a = TypeArgs.parse(args);
      await requireSandbox().type(a);
      return { ok: true };
    }
    case "key": {
      const a = KeyArgs.parse(args);
      await requireSandbox().key(a.keys);
      return { ok: true };
    }
    case "scroll": {
      const a = ScrollArgs.parse(args);
      await requireSandbox().scroll(a);
      return { ok: true };
    }
    case "wait": {
      const a = WaitArgs.parse(args);
      await sleep(a.seconds * 1000);
      return { ok: true };
    }
    case "dump_dom": {
      const a = ScreenIdOnly.parse(args);
      const p = await requireSandbox().dumpDom(a.screen_id);
      requireTracker().addArtifact(a.screen_id, p);
      return { path: p };
    }
    case "dump_a11y": {
      const a = ScreenIdOnly.parse(args);
      const p = await requireSandbox().dumpA11y(a.screen_id);
      requireTracker().addArtifact(a.screen_id, p);
      return { path: p };
    }
    case "start_har": {
      const a = ScreenIdOnly.parse(args);
      await requireSandbox().startHar(a.screen_id);
      return { ok: true };
    }
    case "stop_har": {
      const a = ScreenIdOnly.parse(args);
      const p = await requireSandbox().stopHar(a.screen_id);
      if (p) requireTracker().addArtifact(a.screen_id, p);
      return { path: p };
    }
    case "eval_js": {
      const a = EvalArgs.parse(args);
      const result = await requireSandbox().evalJs(a.script);
      return { result };
    }
    case "write_narration": {
      const a = NarrationArgs.parse(args);
      const p = await requireSandbox().writeNarration(a.screen_id, a.content);
      requireTracker().addArtifact(a.screen_id, p);
      return { path: p };
    }
    case "write_metadata": {
      const a = MetadataArgs.parse(args);
      const p = await requireSandbox().writeMetadata(a.screen_id, a.metadata);
      requireTracker().addArtifact(a.screen_id, p);
      return { path: p };
    }
    case "mark_screen": {
      const a = MarkScreenArgs.parse(args);
      const t = requireTracker();
      const e = t.upsert(a.screen_id, { status: a.status, error: a.error });
      if (a.steps_used !== undefined) e.steps_used = a.steps_used;
      return { entry: e };
    }
    case "end_session": {
      const sb = requireSandbox();
      const t = requireTracker();
      t.manifest.ended_at = nowIso();
      const manifestPath = await writeManifest(CAPTURES_ROOT, runId!, t.manifest);
      await renderRunReports({ capturesRoot: CAPTURES_ROOT, reportsRoot: REPORTS_ROOT, runId: runId! }, t.manifest);
      await sb.kill();
      const result = { manifest_path: manifestPath, report_index: path.join(REPORTS_ROOT, runId!, "index.md"), screens: t.manifest.screens.length };
      sandbox = null; tracker = null; runId = null;
      return result;
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[capture-mcp] ready\n");
}

main().catch((e) => {
  process.stderr.write(`[capture-mcp] fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
