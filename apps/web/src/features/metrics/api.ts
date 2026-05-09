import type {
  Dashboard,
  MetricQuery,
  SavedWidget,
  Series,
  TimeRange,
  VisualizationType,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Required when API_URL is a relative path (e.g. "/api" in prod builds): the
// URL constructor throws on relative inputs without a base. Ignored when the
// endpoint is absolute.
const URL_BASE =
  typeof window !== "undefined" ? window.location.origin : "http://localhost";

export const metricsEndpoints = {
  metricNames: `${API_URL}/metrics/names`,
  tagKeys: `${API_URL}/metrics/tag-keys`,
  tagValues: `${API_URL}/metrics/tag-values`,
  series: `${API_URL}/metrics/series`,
  dashboards: `${API_URL}/dashboards`,
  appendWidget: (dashboardId: string) =>
    `${API_URL}/dashboards/${dashboardId}/widgets`,
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
  const url = new URL(metricsEndpoints.metricNames, URL_BASE);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url.toString(), { credentials: "include" });
  return jsonOrThrow<string[]>(res, "GET /metrics/names");
}

export async function fetchTagKeys(metricName: string): Promise<string[]> {
  const url = new URL(metricsEndpoints.tagKeys, URL_BASE);
  if (metricName) url.searchParams.set("metric", metricName);
  const res = await fetch(url.toString(), { credentials: "include" });
  return jsonOrThrow<string[]>(res, "GET /metrics/tag-keys");
}

export async function fetchTagValues(
  metricName: string,
  tag: string,
): Promise<string[]> {
  const url = new URL(metricsEndpoints.tagValues, URL_BASE);
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
  const res = await fetch(metricsEndpoints.dashboards, {
    credentials: "include",
  });
  const list = await jsonOrThrow<Array<{ id: string; name: string }>>(
    res,
    "GET /dashboards",
  );
  return list.map((d) => ({ id: d.id, name: d.name }));
}

type VisualizationMapping = {
  widgetType:
    | "timeseries"
    | "heatmap"
    | "top_list"
    | "query_value"
    | "pie-chart";
  display?: "lines" | "bars" | "areas";
};

function mapVisualization(v: VisualizationType): VisualizationMapping {
  switch (v) {
    case "line":
      return { widgetType: "timeseries", display: "lines" };
    case "bar":
      return { widgetType: "timeseries", display: "bars" };
    case "area":
      return { widgetType: "timeseries", display: "areas" };
    case "heatmap":
      return { widgetType: "heatmap" };
    case "toplist":
      return { widgetType: "top_list" };
    case "query_value":
      return { widgetType: "query_value" };
  }
}

export async function saveWidgetToDashboard(
  widget: Omit<SavedWidget, "id" | "createdAt">,
): Promise<SavedWidget> {
  const widgetId = `w_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = Date.now();
  const { widgetType, display } = mapVisualization(widget.visualization);

  const payload = {
    id: widgetId,
    type: widgetType,
    title: widget.title,
    queries: widget.queries.map((q) => ({
      id: q.id,
      alias: q.alias,
      metricName: q.metricName,
      aggregator: q.aggregator,
      filters: q.filters,
      groupBy: q.groupBy,
    })),
    display,
    createdAt,
  };

  const res = await fetch(metricsEndpoints.appendWidget(widget.dashboardId), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await jsonOrThrow<unknown>(
    res,
    `POST /dashboards/${widget.dashboardId}/widgets`,
  );

  return { ...widget, id: widgetId, createdAt };
}
