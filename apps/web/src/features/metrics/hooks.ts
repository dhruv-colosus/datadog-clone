"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchDashboards,
  fetchMetricNames,
  fetchMetricSeries,
  fetchTagKeys,
  fetchTagValues,
  saveWidgetToDashboard,
} from "./api";
import { useDashboardWidgetsStore } from "./dashboards-store";
import type {
  MetricQuery,
  SavedWidget,
  TimeRange,
} from "./types";

export const metricKeys = {
  all: ["metrics"] as const,
  names: (prefix?: string) =>
    ["metrics", "names", prefix ?? ""] as const,
  tagKeys: (metric: string) =>
    ["metrics", "tag-keys", metric] as const,
  tagValues: (metric: string, tag: string) =>
    ["metrics", "tag-values", metric, tag] as const,
  series: (query: MetricQuery, range: TimeRange) =>
    [
      "metrics",
      "series",
      query.metricName,
      query.aggregator,
      query.filters,
      query.groupBy,
      query.functions,
      range.fromMs,
      range.toMs,
    ] as const,
  dashboards: () => ["metrics", "dashboards"] as const,
};

export function useMetricNames(prefix?: string) {
  return useQuery({
    queryKey: metricKeys.names(prefix),
    queryFn: () => fetchMetricNames(prefix),
    staleTime: 60_000,
  });
}

export function useMetricTagKeys(metricName: string) {
  return useQuery({
    queryKey: metricKeys.tagKeys(metricName),
    queryFn: () => fetchTagKeys(metricName),
    enabled: Boolean(metricName),
    staleTime: 60_000,
  });
}

export function useMetricTagValues(metricName: string, tag: string) {
  return useQuery({
    queryKey: metricKeys.tagValues(metricName, tag),
    queryFn: () => fetchTagValues(metricName, tag),
    enabled: Boolean(metricName) && Boolean(tag),
    staleTime: 60_000,
  });
}

export function useMetricSeries(query: MetricQuery, range: TimeRange) {
  return useQuery({
    queryKey: metricKeys.series(query, range),
    queryFn: () => fetchMetricSeries(query, range),
    enabled: Boolean(query.metricName) && query.enabled,
    staleTime: 30_000,
  });
}

export function useMultipleMetricSeries(
  queries: MetricQuery[],
  range: TimeRange,
) {
  return useQueries({
    queries: queries.map((query) => ({
      queryKey: metricKeys.series(query, range),
      queryFn: () => fetchMetricSeries(query, range),
      enabled: Boolean(query.metricName) && query.enabled,
      staleTime: 30_000,
    })),
  });
}

export function useDashboards() {
  return useQuery({
    queryKey: metricKeys.dashboards(),
    queryFn: fetchDashboards,
    staleTime: 5 * 60_000,
  });
}

export function useSaveWidget() {
  const qc = useQueryClient();
  const addLocal = useDashboardWidgetsStore((s) => s.add);
  return useMutation({
    mutationFn: (widget: Omit<SavedWidget, "id" | "createdAt">) =>
      saveWidgetToDashboard(widget),
    onSuccess: (created) => {
      addLocal(created);
      qc.invalidateQueries({ queryKey: metricKeys.dashboards() });
    },
  });
}
