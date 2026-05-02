import { promises as fs } from "node:fs";
import YAML from "yaml";
import { CaptureTargetsSchema, type CaptureTargets, type ScreenTarget } from "./types.js";

function expandEnv(input: string): string {
  return input.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`capture-targets references env var ${name} but it is not set`);
    return v;
  });
}

export async function loadCaptureTargets(filePath: string): Promise<CaptureTargets> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = YAML.parse(raw);
  if (parsed && typeof parsed.base_url === "string") {
    parsed.base_url = expandEnv(parsed.base_url);
  }
  return CaptureTargetsSchema.parse(parsed);
}

export function findScreen(targets: CaptureTargets, id: string): ScreenTarget | undefined {
  return targets.screens.find((s) => s.id === id);
}
