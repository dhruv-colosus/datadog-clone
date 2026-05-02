import {
  ALL_TAG_KEYS,
  MOCK_DASHBOARDS,
  MOCK_METRICS,
  generateMockSeries,
  getValuesForTag,
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

const ARTIFICIAL_DELAY_MS = 120;

function delay<T>(value: T, ms = ARTIFICIAL_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchMetricNames(prefix?: string): Promise<string[]> {
  const lower = prefix?.toLowerCase() ?? "";
  const list = lower
    ? MOCK_METRICS.filter((m) => m.toLowerCase().includes(lower))
    : MOCK_METRICS;
  return delay(list.slice(0, 50));
}

export async function fetchTagKeys(_metricName: string): Promise<string[]> {
  return delay(ALL_TAG_KEYS);
}

export async function fetchTagValues(
  _metricName: string,
  tag: string,
): Promise<string[]> {
  return delay(getValuesForTag(tag));
}

export async function fetchMetricSeries(
  query: MetricQuery,
  range: TimeRange,
): Promise<Series[]> {
  return delay(generateMockSeries(query, range));
}

export async function fetchDashboards(): Promise<Dashboard[]> {
  return delay(MOCK_DASHBOARDS);
}

export async function saveWidgetToDashboard(
  widget: Omit<SavedWidget, "id" | "createdAt">,
): Promise<SavedWidget> {
  const created: SavedWidget = {
    ...widget,
    id: `w_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
  };
  return delay(created);
}
