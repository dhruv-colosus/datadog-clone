import type { WatchdogStatus, WatchdogStory } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const watchdogEndpoints = {
  list: `${API_URL}/watchdog/stories`,
  byId: (id: string) => `${API_URL}/watchdog/stories/${id}`,
};

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ? ` — ${body.detail}` : "";
    } catch {
      // ignore
    }
    throw new Error(`${label} failed: ${res.status} ${res.statusText}${detail}`);
  }
  return res.json() as Promise<T>;
}

export type WatchdogFilters = {
  severity?: string[];
  status?: string[];
  service?: string[];
  kind?: string[];
};

function buildQuery(filters: WatchdogFilters | undefined): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  for (const [k, vs] of Object.entries(filters)) {
    for (const v of vs ?? []) params.append(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listStories(
  filters?: WatchdogFilters,
): Promise<WatchdogStory[]> {
  const res = await fetch(watchdogEndpoints.list + buildQuery(filters), {
    credentials: "include",
  });
  return jsonOrThrow<WatchdogStory[]>(res, "GET /watchdog/stories");
}

export async function getStory(id: string): Promise<WatchdogStory> {
  const res = await fetch(watchdogEndpoints.byId(id), {
    credentials: "include",
  });
  return jsonOrThrow<WatchdogStory>(res, `GET /watchdog/stories/${id}`);
}

export async function patchStory(
  id: string,
  status: WatchdogStatus,
): Promise<WatchdogStory> {
  const res = await fetch(watchdogEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return jsonOrThrow<WatchdogStory>(res, `PATCH /watchdog/stories/${id}`);
}
