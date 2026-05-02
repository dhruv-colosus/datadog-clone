import { z } from "zod";

export const ScreenTargetSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "screen id must be kebab-case"),
  name: z.string().min(1),
  url: z.string().min(1),
  follow: z.string().optional(),
  intent: z.string().min(1),
  states: z.array(z.string()).default(["default"]),
  budget_steps: z.number().int().positive().default(20),
});
export type ScreenTarget = z.infer<typeof ScreenTargetSchema>;

export const CaptureTargetsSchema = z.object({
  version: z.literal(1),
  base_url: z.string().min(1),
  screens: z.array(ScreenTargetSchema).min(1),
});
export type CaptureTargets = z.infer<typeof CaptureTargetsSchema>;

export type ScreenStatus = "captured" | "partial" | "aborted_unsafe" | "error";

export interface ScreenManifestEntry {
  id: string;
  name: string;
  url: string;
  status: ScreenStatus;
  steps_used: number;
  artifacts: string[];
  started_at: string;
  ended_at: string;
  error?: string;
}

export interface RunManifest {
  run_id: string;
  base_url: string;
  started_at: string;
  ended_at?: string;
  sandbox_id?: string;
  screens: ScreenManifestEntry[];
}
