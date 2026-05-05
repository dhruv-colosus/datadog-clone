import type {
  Monitor,
  MonitorAuthor,
  MonitorPack,
  MonitorPriority,
  MonitorStatus,
  MonitorType,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const monitorsEndpoints = {
  list: `${API_URL}/monitors`,
  preview: `${API_URL}/monitors/preview`,
  previewAnomaly: `${API_URL}/monitors/preview/anomaly`,
  previewForecast: `${API_URL}/monitors/preview/forecast`,
  byId: (id: string) => `${API_URL}/monitors/${id}`,
  mute: (id: string) => `${API_URL}/monitors/${id}/mute`,
  unmute: (id: string) => `${API_URL}/monitors/${id}/unmute`,
  resolve: (id: string) => `${API_URL}/monitors/${id}/resolve`,
};

export type MonitorPreviewPayload = {
  metric: string;
  aggregator: "avg" | "sum" | "min" | "max";
  window_seconds: number;
  operator: ">" | ">=" | "<" | "<=";
  critical: number | null;
  warning: number | null;
};

export type MonitorPreviewResponse = {
  value: number | null;
  status: "OK" | "Warn" | "Alert" | "No Data";
  metric: string;
  windowSeconds: number;
};

export type MuteDuration = "1h" | "4h" | "12h" | "1d" | "1w" | "forever";

export type CreateMonitorPayload = {
  name: string;
  type: MonitorType;
  query?: Record<string, unknown>;
  thresholds?: Record<string, unknown>;
  message?: string | null;
  recovery_message?: string | null;
  impact?: string | null;
  runbook_steps?: string[];
  tags?: string[];
  priority?: number | null;
  team?: string | null;
};

export type PatchMonitorPayload = Partial<CreateMonitorPayload> & {
  muted?: boolean;
};

type MonitorApiResponse = {
  id: string;
  name: string;
  type: string;
  status: MonitorStatus;
  priority: MonitorPriority;
  tags: string[];
  query: Record<string, unknown> | string;
  thresholds: Record<string, unknown>;
  message: string | null;
  recoveryMessage: string | null;
  impact: string | null;
  runbookSteps: string[];
  team: string | null;
  muted: boolean;
  mutedUntilMs: number | null;
  createdMs: number;
};

const FALLBACK_AUTHOR: MonitorAuthor = {
  name: "Vedanta Neogi",
  avatarColor: "#7c8a5b",
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

function packForType(type: string): MonitorPack {
  return type === "host" ? "host" : "rum";
}

function queryToString(q: Record<string, unknown> | string | undefined): string {
  if (!q) return "";
  if (typeof q === "string") return q;
  if (typeof q.expr === "string") return q.expr;
  return JSON.stringify(q);
}

export function responseToMonitor(r: MonitorApiResponse): Monitor {
  const thresholds = r.thresholds ?? {};
  const threshold =
    typeof thresholds.critical === "number"
      ? (thresholds.critical as number)
      : typeof thresholds.warning === "number"
        ? (thresholds.warning as number)
        : 0;
  const evaluationLabel =
    typeof thresholds.evaluation === "string"
      ? (thresholds.evaluation as string)
      : "AVG over the last 5m";
  const thresholdLabel =
    typeof thresholds.label === "string"
      ? (thresholds.label as string)
      : `y > ${threshold}`;

  return {
    id: r.id,
    name: r.name,
    status: r.status,
    priority: r.priority,
    type: r.type as MonitorType,
    pack: packForType(r.type),
    tags: r.tags ?? [],
    query: queryToString(r.query),
    evaluationLabel,
    thresholdLabel,
    threshold,
    source: r.type === "host" ? "Infrastructure" : "Real User Monitoring",
    createdMs: r.createdMs,
    author: FALLBACK_AUTHOR,
    message: r.message ?? "",
    recoveryMessage: r.recoveryMessage ?? "",
    impact: r.impact ?? "",
    runbookSteps: r.runbookSteps ?? [],
    team: r.team ?? "",
    muted: r.muted,
    mutedUntilMs: r.mutedUntilMs ?? null,
  };
}

export async function listMonitors(): Promise<Monitor[]> {
  const res = await fetch(monitorsEndpoints.list, { credentials: "include" });
  const data = await jsonOrThrow<MonitorApiResponse[]>(res, "GET /monitors");
  return data.map(responseToMonitor);
}

export async function getMonitor(id: string): Promise<Monitor> {
  const res = await fetch(monitorsEndpoints.byId(id), { credentials: "include" });
  const data = await jsonOrThrow<MonitorApiResponse>(res, `GET /monitors/${id}`);
  return responseToMonitor(data);
}

export async function createMonitor(
  payload: CreateMonitorPayload,
): Promise<Monitor> {
  const res = await fetch(monitorsEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await jsonOrThrow<MonitorApiResponse>(res, "POST /monitors");
  return responseToMonitor(data);
}

export async function patchMonitor(
  id: string,
  payload: PatchMonitorPayload,
): Promise<Monitor> {
  const res = await fetch(monitorsEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await jsonOrThrow<MonitorApiResponse>(
    res,
    `PATCH /monitors/${id}`,
  );
  return responseToMonitor(data);
}

export async function deleteMonitor(id: string): Promise<void> {
  const res = await fetch(monitorsEndpoints.byId(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /monitors/${id} failed: ${res.status}`);
  }
}

export async function muteMonitor(
  id: string,
  duration: MuteDuration,
): Promise<Monitor> {
  const res = await fetch(monitorsEndpoints.mute(id), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duration }),
  });
  const data = await jsonOrThrow<MonitorApiResponse>(
    res,
    `POST /monitors/${id}/mute`,
  );
  return responseToMonitor(data);
}

export async function unmuteMonitor(id: string): Promise<Monitor> {
  const res = await fetch(monitorsEndpoints.unmute(id), {
    method: "POST",
    credentials: "include",
  });
  const data = await jsonOrThrow<MonitorApiResponse>(
    res,
    `POST /monitors/${id}/unmute`,
  );
  return responseToMonitor(data);
}

export async function previewMonitor(
  payload: MonitorPreviewPayload,
): Promise<MonitorPreviewResponse> {
  const res = await fetch(monitorsEndpoints.preview, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<MonitorPreviewResponse>(res, "POST /monitors/preview");
}

export type AnomalyPreviewPayload = {
  metric: string;
  window_seconds: number;
  rollup_seconds: number;
  deviations: number;
  direction: "above" | "below" | "both";
  algorithm: "basic" | "agile" | "robust";
};

export type AnomalyPreviewResponse = {
  metric: string;
  status: "OK" | "Alert" | "No Data";
  points: { ts: number; value: number }[];
  upper: number | null;
  lower: number | null;
  mean: number | null;
  currentValue: number | null;
};

export async function previewAnomaly(
  payload: AnomalyPreviewPayload,
): Promise<AnomalyPreviewResponse> {
  const res = await fetch(monitorsEndpoints.previewAnomaly, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<AnomalyPreviewResponse>(
    res,
    "POST /monitors/preview/anomaly",
  );
}

export type ForecastPreviewPayload = {
  metric: string;
  window_seconds: number;
  rollup_seconds: number;
  forecast_window_seconds: number;
  threshold: number;
  operator: ">" | ">=" | "<" | "<=";
  algorithm: "linear" | "seasonal";
};

export type ForecastPreviewResponse = {
  metric: string;
  status: "OK" | "Warn" | "No Data";
  points: { ts: number; value: number }[];
  forecast: { ts: number; value: number }[];
  threshold: number;
  currentValue: number | null;
  projectedValue: number | null;
};

export async function previewForecast(
  payload: ForecastPreviewPayload,
): Promise<ForecastPreviewResponse> {
  const res = await fetch(monitorsEndpoints.previewForecast, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<ForecastPreviewResponse>(
    res,
    "POST /monitors/preview/forecast",
  );
}

export async function resolveMonitor(id: string): Promise<Monitor> {
  const res = await fetch(monitorsEndpoints.resolve(id), {
    method: "POST",
    credentials: "include",
  });
  const data = await jsonOrThrow<MonitorApiResponse>(
    res,
    `POST /monitors/${id}/resolve`,
  );
  return responseToMonitor(data);
}
