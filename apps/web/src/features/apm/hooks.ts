"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchApmFacets,
  fetchApmRecommendations,
  fetchApmResources,
  fetchApmService,
  fetchApmServiceResourceSeries,
  fetchApmServiceSummarySeries,
  fetchApmServices,
  searchApmSpans,
} from "./api";
import type { ApmTimeRange, ApmTracesQuery } from "./types";

export const apmKeys = {
  all: ["apm"] as const,
  services: (env: string) => ["apm", "services", env] as const,
  service: (id: string) => ["apm", "service", id] as const,
  recommendations: (type: string) => ["apm", "recommendations", type] as const,
  resources: (id: string) => ["apm", "resources", id] as const,
  serviceSummary: (id: string) => ["apm", "service-summary-series", id] as const,
  serviceResources: (id: string) =>
    ["apm", "service-resources-series", id] as const,
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
  });
}

export function useApmServiceSummarySeries(serviceId: string) {
  return useQuery({
    queryKey: apmKeys.serviceSummary(serviceId),
    queryFn: () => fetchApmServiceSummarySeries(serviceId),
    staleTime: 30_000,
  });
}

export function useApmServiceResourceSeries(serviceId: string) {
  return useQuery({
    queryKey: apmKeys.serviceResources(serviceId),
    queryFn: () => fetchApmServiceResourceSeries(serviceId),
    staleTime: 30_000,
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
