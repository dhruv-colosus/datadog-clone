import type {
  ApmDependency,
  ApmFacets,
  ApmIssue,
  ApmOperation,
  ApmRecommendation,
  ApmResource,
  ApmService,
  ApmServiceMap,
  ApmServiceSeries,
  ApmSpan,
  ApmTimeRange,
  ApmTraceDetail,
  ApmTracesQuery,
  ApmWatchdogAnomaly,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Base for `new URL(endpoint, URL_BASE)`. Required when API_URL is a relative
// path (e.g. "/api" in prod builds) — the URL constructor throws on relative
// inputs without a base. Ignored when the endpoint is already absolute.
const URL_BASE =
  typeof window !== "undefined" ? window.location.origin : "http://localhost";

export const apmEndpoints = {
  services: `${API_URL}/apm/services`,
  service: (name: string) => `${API_URL}/apm/services/${name}`,
  operations: (name: string) => `${API_URL}/apm/services/${name}/operations`,
  resources: (name: string) => `${API_URL}/apm/services/${name}/resources`,
  serviceSeries: (name: string) => `${API_URL}/apm/services/${name}/series`,
  resourcesSeries: (name: string) =>
    `${API_URL}/apm/services/${name}/resources-series`,
  dependencies: `${API_URL}/apm/dependencies`,
  serviceMap: `${API_URL}/apm/service-map`,
  spansSearch: `${API_URL}/apm/spans/search`,
  spansFacets: `${API_URL}/apm/spans/facets`,
  trace: (id: string) => `${API_URL}/apm/traces/${id}`,
  recommendations: `${API_URL}/apm/recommendations`,
  watchdog: `${API_URL}/apm/watchdog`,
  issues: `${API_URL}/apm/issues`,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchApmServices(env: string): Promise<ApmService[]> {
  const url = new URL(apmEndpoints.services, URL_BASE);
  if (env) url.searchParams.set("env", env);
  return getJson<ApmService[]>(url.toString());
}

export async function fetchApmService(id: string): Promise<ApmService | null> {
  try {
    return await getJson<ApmService>(apmEndpoints.service(id));
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function fetchApmOperations(
  serviceId: string,
): Promise<ApmOperation[]> {
  return getJson<ApmOperation[]>(apmEndpoints.operations(serviceId));
}

export async function fetchApmResources(
  serviceId: string,
): Promise<ApmResource[]> {
  return getJson<ApmResource[]>(apmEndpoints.resources(serviceId));
}

export async function fetchApmServiceSummarySeries(
  serviceId: string,
  range: ApmTimeRange,
): Promise<ApmServiceSeries[]> {
  const url = new URL(apmEndpoints.serviceSeries(serviceId), URL_BASE);
  url.searchParams.set("fromMs", String(range.fromMs));
  url.searchParams.set("toMs", String(range.toMs));
  const res = await getJson<{
    service: string;
    points: ApmServiceSeries["points"];
  }>(url.toString());
  return [{ service: res.service, points: res.points }];
}

export async function fetchApmServiceResourceSeries(
  serviceId: string,
  range: ApmTimeRange,
): Promise<ApmServiceSeries[]> {
  const url = new URL(apmEndpoints.resourcesSeries(serviceId), URL_BASE);
  url.searchParams.set("fromMs", String(range.fromMs));
  url.searchParams.set("toMs", String(range.toMs));
  return getJson<ApmServiceSeries[]>(url.toString());
}

export async function fetchApmDependencies(): Promise<ApmDependency[]> {
  return getJson<ApmDependency[]>(apmEndpoints.dependencies);
}

export async function fetchApmServiceMap(
  env?: string,
  lookbackSeconds = 600,
): Promise<ApmServiceMap> {
  const url = new URL(apmEndpoints.serviceMap, URL_BASE);
  if (env) url.searchParams.set("env", env);
  url.searchParams.set("lookbackSeconds", String(lookbackSeconds));
  return getJson<ApmServiceMap>(url.toString());
}

function buildSpansBody(query: ApmTracesQuery, range: ApmTimeRange) {
  // The query bar lets users type `env:prod` etc; pull it out so the backend
  // can apply env as a column filter rather than scanning the resource text.
  const envMatch = query.text.match(/env:(\w+)/);
  const free = query.text.replace(/env:\w+/g, "").trim();
  return {
    query: {
      text: free,
      services: query.services,
      statuses: query.statuses,
      resources: query.resources,
      env: envMatch?.[1] ?? null,
    },
    range: { fromMs: range.fromMs, toMs: range.toMs },
    limit: 200,
  };
}

export async function searchApmSpans(
  query: ApmTracesQuery,
  range: ApmTimeRange,
): Promise<ApmSpan[]> {
  return postJson<ApmSpan[]>(
    apmEndpoints.spansSearch,
    buildSpansBody(query, range),
  );
}

export async function fetchApmFacets(
  query: ApmTracesQuery,
  range: ApmTimeRange,
): Promise<ApmFacets> {
  return postJson<ApmFacets>(
    apmEndpoints.spansFacets,
    buildSpansBody(query, range),
  );
}

export async function fetchApmTrace(traceId: string): Promise<ApmTraceDetail> {
  return getJson<ApmTraceDetail>(apmEndpoints.trace(traceId));
}

export async function fetchApmRecommendations(
  type: "all" | "performance" | "reliability" | "cost",
): Promise<ApmRecommendation[]> {
  const url = new URL(apmEndpoints.recommendations, URL_BASE);
  if (type !== "all") url.searchParams.set("type", type);
  return getJson<ApmRecommendation[]>(url.toString());
}

export async function fetchApmWatchdog(
  lookbackHours = 48,
): Promise<ApmWatchdogAnomaly[]> {
  const url = new URL(apmEndpoints.watchdog, URL_BASE);
  url.searchParams.set("lookbackHours", String(lookbackHours));
  return getJson<ApmWatchdogAnomaly[]>(url.toString());
}

export async function fetchApmIssues(
  lookbackSeconds = 3600,
): Promise<ApmIssue[]> {
  const url = new URL(apmEndpoints.issues, URL_BASE);
  url.searchParams.set("lookbackSeconds", String(lookbackSeconds));
  return getJson<ApmIssue[]>(url.toString());
}
