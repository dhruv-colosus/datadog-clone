"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchApmDependencies,
  fetchApmFacets,
  fetchApmIssues,
  fetchApmOperations,
  fetchApmRecommendations,
  fetchApmResources,
  fetchApmService,
  fetchApmServiceMap,
  fetchApmServiceResourceSeries,
  fetchApmServiceSummarySeries,
  fetchApmServices,
  fetchApmTrace,
  fetchApmWatchdog,
  searchApmSpans,
} from "./api";
import type { ApmTimeRange, ApmTracesQuery } from "./types";

export const apmKeys = {
  all: ["apm"] as const,
  services: (env: string) => ["apm", "services", env] as const,
  service: (id: string) => ["apm", "service", id] as const,
  operations: (id: string) => ["apm", "operations", id] as const,
  recommendations: (type: string) => ["apm", "recommendations", type] as const,
  resources: (id: string) => ["apm", "resources", id] as const,
  serviceSummary: (id: string, fromMs: number, toMs: number) =>
    ["apm", "service-summary-series", id, fromMs, toMs] as const,
  serviceResources: (id: string, fromMs: number, toMs: number) =>
    ["apm", "service-resources-series", id, fromMs, toMs] as const,
  spans: (q: ApmTracesQuery, r: ApmTimeRange) =>
    [
      "apm",
      "spans",
      q.text,
      q.services,
      q.statuses,
      q.resources,
      r.fromMs,
      r.toMs,
    ] as const,
  facets: (q: ApmTracesQuery, r: ApmTimeRange) =>
    [
      "apm",
      "facets",
      q.text,
      q.services,
      q.statuses,
      q.resources,
      r.fromMs,
      r.toMs,
    ] as const,
  dependencies: () => ["apm", "dependencies"] as const,
  serviceMap: (env: string, lookback: number) =>
    ["apm", "service-map", env, lookback] as const,
  trace: (id: string) => ["apm", "trace", id] as const,
  watchdog: (lookbackHours: number) =>
    ["apm", "watchdog", lookbackHours] as const,
  issues: (lookbackSeconds: number) =>
    ["apm", "issues", lookbackSeconds] as const,
};

export function useApmServices(env: string) {
  return useQuery({
    queryKey: apmKeys.services(env),
    queryFn: () => fetchApmServices(env),
    staleTime: 30_000,
  });
}

export function useApmService(id: string) {
  return useQuery({
    queryKey: apmKeys.service(id),
    queryFn: () => fetchApmService(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

export function useApmOperations(serviceId: string) {
  return useQuery({
    queryKey: apmKeys.operations(serviceId),
    queryFn: () => fetchApmOperations(serviceId),
    staleTime: 30_000,
    enabled: Boolean(serviceId),
  });
}

export function useApmRecommendations(
  type: "all" | "performance" | "reliability" | "cost",
) {
  return useQuery({
    queryKey: apmKeys.recommendations(type),
    queryFn: () => fetchApmRecommendations(type),
    staleTime: 60_000,
  });
}

export function useApmResources(serviceId: string) {
  return useQuery({
    queryKey: apmKeys.resources(serviceId),
    queryFn: () => fetchApmResources(serviceId),
    staleTime: 30_000,
    enabled: Boolean(serviceId),
  });
}

export function useApmServiceSummarySeries(
  serviceId: string,
  range: ApmTimeRange,
) {
  return useQuery({
    queryKey: apmKeys.serviceSummary(serviceId, range.fromMs, range.toMs),
    queryFn: () => fetchApmServiceSummarySeries(serviceId, range),
    staleTime: 30_000,
    enabled: Boolean(serviceId),
  });
}

export function useApmServiceResourceSeries(
  serviceId: string,
  range: ApmTimeRange,
) {
  return useQuery({
    queryKey: apmKeys.serviceResources(serviceId, range.fromMs, range.toMs),
    queryFn: () => fetchApmServiceResourceSeries(serviceId, range),
    staleTime: 30_000,
    enabled: Boolean(serviceId),
  });
}

export function useApmSpans(query: ApmTracesQuery, range: ApmTimeRange) {
  return useQuery({
    queryKey: apmKeys.spans(query, range),
    queryFn: () => searchApmSpans(query, range),
    staleTime: 10_000,
  });
}

export function useApmFacets(query: ApmTracesQuery, range: ApmTimeRange) {
  return useQuery({
    queryKey: apmKeys.facets(query, range),
    queryFn: () => fetchApmFacets(query, range),
    staleTime: 30_000,
  });
}

export function useApmDependencies() {
  return useQuery({
    queryKey: apmKeys.dependencies(),
    queryFn: () => fetchApmDependencies(),
    staleTime: 5 * 60_000,
  });
}

export function useApmServiceMap(env: string, lookbackSeconds = 600) {
  return useQuery({
    queryKey: apmKeys.serviceMap(env, lookbackSeconds),
    queryFn: () => fetchApmServiceMap(env, lookbackSeconds),
    staleTime: 30_000,
  });
}

export function useApmTrace(traceId: string) {
  return useQuery({
    queryKey: apmKeys.trace(traceId),
    queryFn: () => fetchApmTrace(traceId),
    staleTime: 60_000,
    enabled: Boolean(traceId),
  });
}

export function useApmWatchdog(lookbackHours = 48) {
  return useQuery({
    queryKey: apmKeys.watchdog(lookbackHours),
    queryFn: () => fetchApmWatchdog(lookbackHours),
    staleTime: 60_000,
  });
}

export function useApmIssues(lookbackSeconds = 3600) {
  return useQuery({
    queryKey: apmKeys.issues(lookbackSeconds),
    queryFn: () => fetchApmIssues(lookbackSeconds),
    staleTime: 60_000,
  });
}
