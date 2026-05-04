"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchApplication,
  fetchApplications,
  fetchDeployments,
  fetchErrorGroups,
  fetchErrorRate,
  fetchResourcePerformance,
  fetchSeries,
  fetchSession,
  fetchSessions,
  fetchSummary,
  fetchTopViews,
  fetchViews,
  fetchVitals,
  type SessionListFilters,
} from "./api";
import type { RumPerfMetric, RumTimeRange } from "./types";

const KEYS = {
  apps: ["rum", "applications"] as const,
  app: (id: string) => ["rum", "applications", id] as const,
  summary: (id: string, range?: RumTimeRange) =>
    ["rum", "applications", id, "summary", range?.fromMs, range?.toMs] as const,
  series: (id: string, metric: RumPerfMetric, range?: RumTimeRange) =>
    ["rum", "applications", id, "series", metric, range?.fromMs, range?.toMs] as const,
  vitals: (id: string, range?: RumTimeRange) =>
    ["rum", "applications", id, "vitals", range?.fromMs, range?.toMs] as const,
  errorRate: (id: string, range?: RumTimeRange) =>
    ["rum", "applications", id, "error-rate", range?.fromMs, range?.toMs] as const,
  deployments: (id: string) => ["rum", "applications", id, "deployments"] as const,
  resources: (id: string, range?: RumTimeRange) =>
    ["rum", "applications", id, "resources", range?.fromMs, range?.toMs] as const,
  topViews: (id: string, range?: RumTimeRange) =>
    ["rum", "applications", id, "top-views", range?.fromMs, range?.toMs] as const,
  sessions: (filters: SessionListFilters) =>
    ["rum", "sessions", filters] as const,
  session: (id: string) => ["rum", "session", id] as const,
  errorGroups: (appId?: string, range?: RumTimeRange) =>
    ["rum", "errors", appId, range?.fromMs, range?.toMs] as const,
  views: (appId?: string, range?: RumTimeRange) =>
    ["rum", "views", appId, range?.fromMs, range?.toMs] as const,
};

export function useRumApplications() {
  return useQuery({
    queryKey: KEYS.apps,
    queryFn: fetchApplications,
    refetchInterval: 60_000,
  });
}

export function useRumApplication(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.app(id) : KEYS.apps,
    queryFn: () => fetchApplication(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useRumSummary(id: string | undefined, range?: RumTimeRange) {
  return useQuery({
    queryKey: id ? KEYS.summary(id, range) : KEYS.apps,
    queryFn: () => fetchSummary(id!, range),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useRumSeries(
  id: string | undefined,
  metric: RumPerfMetric,
  range?: RumTimeRange,
) {
  return useQuery({
    queryKey: id ? KEYS.series(id, metric, range) : KEYS.apps,
    queryFn: () => fetchSeries(id!, metric, range),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useRumVitals(id: string | undefined, range?: RumTimeRange) {
  return useQuery({
    queryKey: id ? KEYS.vitals(id, range) : KEYS.apps,
    queryFn: () => fetchVitals(id!, range),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useRumErrorRate(id: string | undefined, range?: RumTimeRange) {
  return useQuery({
    queryKey: id ? KEYS.errorRate(id, range) : KEYS.apps,
    queryFn: () => fetchErrorRate(id!, range),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useRumDeployments(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.deployments(id) : KEYS.apps,
    queryFn: () => fetchDeployments(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useRumResources(id: string | undefined, range?: RumTimeRange) {
  return useQuery({
    queryKey: id ? KEYS.resources(id, range) : KEYS.apps,
    queryFn: () => fetchResourcePerformance(id!, range),
    enabled: !!id,
  });
}

export function useRumTopViews(id: string | undefined, range?: RumTimeRange) {
  return useQuery({
    queryKey: id ? KEYS.topViews(id, range) : KEYS.apps,
    queryFn: () => fetchTopViews(id!, range),
    enabled: !!id,
  });
}

export function useRumSessions(filters: SessionListFilters) {
  return useQuery({
    queryKey: KEYS.sessions(filters),
    queryFn: () => fetchSessions(filters),
    refetchInterval: 60_000,
  });
}

export function useRumSession(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.session(id) : KEYS.apps,
    queryFn: () => fetchSession(id!),
    enabled: !!id,
  });
}

export function useRumErrorGroups(appId?: string, range?: RumTimeRange) {
  return useQuery({
    queryKey: KEYS.errorGroups(appId, range),
    queryFn: () => fetchErrorGroups(appId, range),
    refetchInterval: 60_000,
  });
}

export function useRumViews(appId?: string, range?: RumTimeRange) {
  return useQuery({
    queryKey: KEYS.views(appId, range),
    queryFn: () => fetchViews(appId, range),
    refetchInterval: 60_000,
  });
}
