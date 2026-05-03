import {
  APM_RECOMMENDATIONS,
  APM_SERVICES,
  APM_SPANS,
  getResourcesForService,
  getServiceResourceSeries,
  getServiceSummarySeries,
} from "./mock-data";
import type {
  ApmFacets,
  ApmRecommendation,
  ApmResource,
  ApmService,
  ApmServiceSeries,
  ApmSpan,
  ApmSpanStatus,
  ApmTimeRange,
  ApmTracesQuery,
} from "./types";

function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchApmServices(env: string): Promise<ApmService[]> {
  return delay(APM_SERVICES.filter((s) => s.env === env));
}

export async function fetchApmService(id: string): Promise<ApmService | null> {
  return delay(APM_SERVICES.find((s) => s.id === id) ?? null);
}

export async function fetchApmRecommendations(
  type: "all" | "performance" | "reliability" | "cost",
): Promise<ApmRecommendation[]> {
  return delay(
    type === "all"
      ? APM_RECOMMENDATIONS
      : APM_RECOMMENDATIONS.filter((r) => r.type === type),
  );
}

export async function fetchApmResources(
  serviceId: string,
): Promise<ApmResource[]> {
  return delay(getResourcesForService(serviceId));
}

export async function fetchApmServiceSummarySeries(
  serviceId: string,
): Promise<ApmServiceSeries[]> {
  return delay(getServiceSummarySeries(serviceId));
}

export async function fetchApmServiceResourceSeries(
  serviceId: string,
): Promise<ApmServiceSeries[]> {
  return delay(getServiceResourceSeries(serviceId));
}

function spanMatchesQuery(span: ApmSpan, q: ApmTracesQuery): boolean {
  if (q.services.length > 0 && !q.services.includes(span.service)) return false;
  if (q.statuses.length > 0 && !q.statuses.includes(span.status)) return false;
  if (q.resources.length > 0 && !q.resources.includes(span.resource))
    return false;
  if (q.text.trim().length > 0) {
    const t = q.text.toLowerCase();
    const stripped = t.replace(/env:\w+/g, "").trim();
    if (
      stripped.length > 0 &&
      !`${span.service} ${span.resource}`.toLowerCase().includes(stripped)
    ) {
      return false;
    }
  }
  return true;
}

export async function searchApmSpans(
  query: ApmTracesQuery,
  range: ApmTimeRange,
): Promise<ApmSpan[]> {
  const list = APM_SPANS.filter(
    (s) =>
      s.timestampMs >= range.fromMs &&
      s.timestampMs <= range.toMs &&
      spanMatchesQuery(s, query),
  );
  return delay(list);
}

export async function fetchApmFacets(
  query: ApmTracesQuery,
  range: ApmTimeRange,
): Promise<ApmFacets> {
  const inRange = APM_SPANS.filter(
    (s) => s.timestampMs >= range.fromMs && s.timestampMs <= range.toMs,
  );

  const matching = inRange.filter((s) => spanMatchesQuery(s, query));

  const statusCounts = new Map<ApmSpanStatus, number>();
  const serviceCounts = new Map<string, number>();
  const resourceCounts = new Map<string, number>();
  const envCounts = new Map<string, number>();

  matching.forEach((s) => {
    statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
    serviceCounts.set(s.service, (serviceCounts.get(s.service) ?? 0) + 1);
    resourceCounts.set(s.resource, (resourceCounts.get(s.resource) ?? 0) + 1);
    envCounts.set("prod", (envCounts.get("prod") ?? 0) + 1);
  });

  const status = (["ok", "error"] as ApmSpanStatus[]).map((v) => ({
    value: v,
    count: statusCounts.get(v) ?? 0,
  }));

  const sortBy = (a: { count: number }, b: { count: number }) =>
    b.count - a.count;

  return delay({
    status,
    service: Array.from(serviceCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort(sortBy),
    resource: Array.from(resourceCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort(sortBy),
    env: Array.from(envCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort(sortBy),
    total: matching.length,
  });
}
