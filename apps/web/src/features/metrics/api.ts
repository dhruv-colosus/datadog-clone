import {
  MOCK_DASHBOARDS,
} from "./mock-data";
import type {
  Dashboard,
  MetricQuery,
  SavedWidget,
  Series,
  TimeRange,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const metricsEndpoints = {
  metricNames: `${API_URL}/metrics/names`,
  tagKeys: `${API_URL}/metrics/tag-keys`,
  tagValues: `${API_URL}/metrics/tag-values`,
  series: `${API_URL}/metrics/series`,
  dashboards: `${API_URL}/dashboards`,
  saveWidget: `${API_URL}/dashboards/widgets`,
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

export async function fetchMetricNames(prefix?: string): Promise<string[]> {
  const url = new URL(metricsEndpoints.metricNames);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url.toString(), { credentials: "include" });
  return jsonOrThrow<string[]>(res, "GET /metrics/names");
}

export async function fetchTagKeys(metricName: string): Promise<string[]> {
  const url = new URL(metricsEndpoints.tagKeys);
  if (metricName) url.searchParams.set("metric", metricName);
  const res = await fetch(url.toString(), { credentials: "include" });
  return jsonOrThrow<string[]>(res, "GET /metrics/tag-keys");
}

export async function fetchTagValues(
  metricName: string,
  tag: string,
): Promise<string[]> {
  const url = new URL(metricsEndpoints.tagValues);
  url.searchParams.set("tag", tag);
  if (metricName) url.searchParams.set("metric", metricName);
  const res = await fetch(url.toString(), { credentials: "include" });
  return jsonOrThrow<string[]>(res, "GET /metrics/tag-values");
}

export async function fetchMetricSeries(
  query: MetricQuery,
  range: TimeRange,
): Promise<Series[]> {
  const res = await fetch(metricsEndpoints.series, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queries: [query],
      range: {
        preset: range.preset,
        fromMs: range.fromMs,
        toMs: range.toMs,
      },
    }),
  });
  return jsonOrThrow<Series[]>(res, "POST /metrics/series");
}

export async function fetchDashboards(): Promise<Dashboard[]> {
  // Dashboards listing for the metrics save-widget flow remains a thin local
  // shim — the dedicated dashboards/api.ts covers the authoritative CRUD path.
  return MOCK_DASHBOARDS;
}

export async function saveWidgetToDashboard(
  widget: Omit<SavedWidget, "id" | "createdAt">,
): Promise<SavedWidget> {
  return {
    ...widget,
    id: `w_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
  };
}
