import { promises as fs } from "node:fs";
import path from "node:path";
import type { RunManifest, ScreenManifestEntry } from "./types.js";

interface RenderOptions {
  capturesRoot: string;
  reportsRoot: string;
  runId: string;
}

export async function renderRunReports(opts: RenderOptions, manifest: RunManifest): Promise<void> {
  const reportDir = path.join(opts.reportsRoot, opts.runId);
  await fs.mkdir(reportDir, { recursive: true });

  for (const screen of manifest.screens) {
    await writeScreenReport(opts, screen);
  }

  const indexPath = path.join(reportDir, "index.md");
  const indexBody = renderIndex(manifest);
  await fs.writeFile(indexPath, indexBody, "utf8");
}

async function writeScreenReport(opts: RenderOptions, screen: ScreenManifestEntry): Promise<void> {
  const reportDir = path.join(opts.reportsRoot, opts.runId);
  const screenDir = path.join(opts.capturesRoot, opts.runId, "screens", screen.id);
  const narrationPath = path.join(screenDir, "narration.md");

  let narration = "";
  try { narration = await fs.readFile(narrationPath, "utf8"); }
  catch { narration = "_No narration was written for this screen._\n"; }

  const screenshots: string[] = [];
  try {
    const files = await fs.readdir(screenDir);
    for (const f of files) if (f.startsWith("screenshot-") && f.endsWith(".png")) screenshots.push(f);
    screenshots.sort();
  } catch {}

  const screenshotsRel = screenshots.map((f) =>
    path.relative(reportDir, path.join(screenDir, f)),
  );

  const lines: string[] = [];
  lines.push(`# ${screen.name}`);
  lines.push("");
  lines.push(`- Screen id: \`${screen.id}\``);
  lines.push(`- URL: ${screen.url}`);
  lines.push(`- Status: **${screen.status}** (${screen.steps_used} steps)`);
  lines.push(`- Captured: ${screen.started_at} → ${screen.ended_at}`);
  if (screen.error) lines.push(`- Error: \`${screen.error}\``);
  lines.push("");
  for (const rel of screenshotsRel) {
    lines.push(`![${path.basename(rel)}](${rel})`);
    lines.push("");
  }
  lines.push("## Narration");
  lines.push("");
  lines.push(narration.trim());
  lines.push("");

  await fs.writeFile(path.join(reportDir, `${screen.id}.md`), lines.join("\n"), "utf8");
}

function renderIndex(manifest: RunManifest): string {
  const lines: string[] = [];
  lines.push(`# Capture run \`${manifest.run_id}\``);
  lines.push("");
  lines.push(`- Base URL: ${manifest.base_url}`);
  lines.push(`- Sandbox: \`${manifest.sandbox_id ?? "n/a"}\``);
  lines.push(`- Started: ${manifest.started_at}`);
  if (manifest.ended_at) lines.push(`- Ended: ${manifest.ended_at}`);
  lines.push("");
  lines.push("| Screen | Status | Steps | Report |");
  lines.push("|---|---|---|---|");
  for (const s of manifest.screens) {
    lines.push(`| ${s.name} | ${s.status} | ${s.steps_used} | [${s.id}.md](${s.id}.md) |`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function writeManifest(capturesRoot: string, runId: string, manifest: RunManifest): Promise<string> {
  const dir = path.join(capturesRoot, runId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "manifest.json");
  await fs.writeFile(file, JSON.stringify(manifest, null, 2), "utf8");
  return file;
}
