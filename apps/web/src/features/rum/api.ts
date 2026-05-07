import type {
  RumApplication,
  RumDeployment,
  RumErrorGroup,
  RumErrorRate,
  RumPerfMetric,
  RumResourcePerf,
  RumSession,
  RumSessionListItem,
  RumSeries,
  RumSummary,
  RumTimeRange,
  RumTopView,
  RumViewListItem,
  RumViewsSeries,
  RumVitals,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Required when API_URL is a relative path (e.g. "/api" in prod builds): the
// URL constructor throws on relative inputs without a base. Ignored when the
// endpoint is absolute.
const URL_BASE =
  typeof window !== "undefined" ? window.location.origin : "http://localhost";

export const rumEndpoints = {
  applications: `${API_URL}/rum/applications`,
  application: (id: string) => `${API_URL}/rum/applications/${id}`,
  summary: (id: string) => `${API_URL}/rum/applications/${id}/summary`,
  series: (id: string) => `${API_URL}/rum/applications/${id}/series`,
  vitals: (id: string) => `${API_URL}/rum/applications/${id}/vitals`,
  errorRate: (id: string) => `${API_URL}/rum/applications/${id}/error-rate`,
  deployments: (id: string) => `${API_URL}/rum/applications/${id}/deployments`,
  resources: (id: string) => `${API_URL}/rum/applications/${id}/resource-performance`,
  topViews: (id: string) => `${API_URL}/rum/applications/${id}/top-views`,
  sessions: `${API_URL}/rum/sessions`,
  session: (id: string) => `${API_URL}/rum/sessions/${id}`,
  errors: `${API_URL}/rum/errors`,
  views: `${API_URL}/rum/views`,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function withRange(url: URL, range?: RumTimeRange): URL {
  if (range) {
    url.searchParams.set("fromMs", String(range.fromMs));
    url.searchParams.set("toMs", String(range.toMs));
  }
  return url;
}

export async function fetchApplications(): Promise<RumApplication[]> {
  return getJson<RumApplication[]>(rumEndpoints.applications);
}

export async function fetchApplication(id: string): Promise<RumApplication> {
  return getJson<RumApplication>(rumEndpoints.application(id));
}

export async function fetchSummary(
  id: string,
  range?: RumTimeRange,
): Promise<RumSummary> {
  return getJson<RumSummary>(withRange(new URL(rumEndpoints.summary(id), URL_BASE), range).toString());
}

export async function fetchSeries(
  id: string,
  metric: RumPerfMetric,
  range?: RumTimeRange,
): Promise<RumSeries | RumViewsSeries> {
  const url = withRange(new URL(rumEndpoints.series(id), URL_BASE), range);
  url.searchParams.set("metric", metric);
  return getJson<RumSeries | RumViewsSeries>(url.toString());
}

export async function fetchVitals(
  id: string,
  range?: RumTimeRange,
): Promise<RumVitals> {
  return getJson<RumVitals>(withRange(new URL(rumEndpoints.vitals(id), URL_BASE), range).toString());
}

export async function fetchErrorRate(
  id: string,
  range?: RumTimeRange,
): Promise<RumErrorRate> {
  return getJson<RumErrorRate>(
    withRange(new URL(rumEndpoints.errorRate(id), URL_BASE), range).toString(),
  );
}

export async function fetchDeployments(id: string): Promise<RumDeployment[]> {
  return getJson<RumDeployment[]>(rumEndpoints.deployments(id));
}

export async function fetchResourcePerformance(
  id: string,
  range?: RumTimeRange,
  limit = 10,
): Promise<RumResourcePerf[]> {
  const url = withRange(new URL(rumEndpoints.resources(id), URL_BASE), range);
  url.searchParams.set("limit", String(limit));
  return getJson<RumResourcePerf[]>(url.toString());
}

export async function fetchTopViews(
  id: string,
  range?: RumTimeRange,
  limit = 10,
): Promise<RumTopView[]> {
  const url = withRange(new URL(rumEndpoints.topViews(id), URL_BASE), range);
  url.searchParams.set("limit", String(limit));
  return getJson<RumTopView[]>(url.toString());
}

export type SessionListFilters = {
  appId?: string;
  range?: RumTimeRange;
  limit?: number;
  minViews?: number;
  minActions?: number;
  minErrors?: number;
  minTimeSpentSeconds?: number;
  minFrustrations?: number;
  country?: string;
  browser?: string;
  device?: string;
  hasError?: boolean;
};

export async function fetchSessions(
  filters: SessionListFilters = {},
): Promise<RumSessionListItem[]> {
  const url = withRange(new URL(rumEndpoints.sessions, URL_BASE), filters.range);
  if (filters.appId) url.searchParams.set("appId", filters.appId);
  if (filters.limit != null) url.searchParams.set("limit", String(filters.limit));
  if (filters.minViews != null)
    url.searchParams.set("minViews", String(filters.minViews));
  if (filters.minActions != null)
    url.searchParams.set("minActions", String(filters.minActions));
  if (filters.minErrors != null)
    url.searchParams.set("minErrors", String(filters.minErrors));
  if (filters.minTimeSpentSeconds != null)
    url.searchParams.set("minTimeSpentSeconds", String(filters.minTimeSpentSeconds));
  if (filters.minFrustrations != null)
    url.searchParams.set("minFrustrations", String(filters.minFrustrations));
  if (filters.country) url.searchParams.set("country", filters.country);
  if (filters.browser) url.searchParams.set("browser", filters.browser);
  if (filters.device) url.searchParams.set("device", filters.device);
  if (filters.hasError != null)
    url.searchParams.set("hasError", String(filters.hasError));
  return getJson<RumSessionListItem[]>(url.toString());
}

export async function fetchSession(id: string): Promise<RumSession> {
  return getJson<RumSession>(rumEndpoints.session(id));
}

export async function fetchErrorGroups(
  appId?: string,
  range?: RumTimeRange,
): Promise<RumErrorGroup[]> {
  const url = withRange(new URL(rumEndpoints.errors, URL_BASE), range);
  if (appId) url.searchParams.set("appId", appId);
  return getJson<RumErrorGroup[]>(url.toString());
}

export async function fetchViews(
  appId?: string,
  range?: RumTimeRange,
  limit = 200,
): Promise<RumViewListItem[]> {
  const url = withRange(new URL(rumEndpoints.views, URL_BASE), range);
  if (appId) url.searchParams.set("appId", appId);
  url.searchParams.set("limit", String(limit));
  return getJson<RumViewListItem[]>(url.toString());
}
