export type RumApplication = {
  id: string;
  name: string;
  type: string;
  service: string;
  env: string;
  clientToken: string;
  totalSessions: number;
  totalViews: number;
  totalErrors: number;
};

export type RumSummary = {
  totalViews: number;
  totalSessions: number;
  totalErrors: number;
  totalActions: number;
  frustratedSessions: number;
  viewsChangePct: number;
  fromMs: number;
  toMs: number;
};

export type RumPerfSeriesPoint = {
  ts: number;
  p50: number;
  p75?: number;
  p95: number;
};
export type RumViewsSeriesPoint = { ts: number; count: number };

export type RumSeries = {
  metric: string;
  current: RumPerfSeriesPoint[];
  previous: RumPerfSeriesPoint[];
};
export type RumViewsSeries = {
  metric: "views";
  current: RumViewsSeriesPoint[];
  previous: RumViewsSeriesPoint[];
};

export type RumVitals = {
  loadingTime: { p75: number; series: { ts: number; value: number }[] };
  lcp: { p75: number; series: { ts: number; value: number }[] };
  fcp: { p75: number; series: { ts: number; value: number }[] };
  cls: { p75: number; series: { ts: number; value: number }[] };
  inp: { p75: number; series: { ts: number; value: number }[] };
};

export type RumErrorRate = {
  errorRate: number;
  views: number;
  errorViews: number;
  series: {
    ts: number;
    errorRate: number;
    views: number;
    errorViews: number;
  }[];
};

export type RumDeployment = {
  service: string;
  version: string;
  sessions: number;
  errors: number;
  webVitalsP75Warnings: number;
};

export type RumResourcePerf = {
  url: string;
  method: string;
  hits: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  errors: number;
};

export type RumTopView = {
  path: string;
  views: number;
  sessions: number;
  loadingTimeP75Ms: number;
  lcpP75Ms: number;
};

export type RumSessionListItem = {
  id: string;
  applicationId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: string | null;
  version: string | null;
  viewCount: number;
  actionCount: number;
  errorCount: number;
  frustrationCount: number;
  timeSpentMs: number;
  entryPath: string | null;
  finalPath: string | null;
  referrer: string | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
};

export type RumTimelineEvent = {
  ts: number;
  tOffsetMs: number;
  type: "view" | "action" | "error" | "resource" | "long_task";
  viewId: string;
  viewPath: string | null;
  attributes: Record<string, unknown>;
  // view
  viewUrl?: string | null;
  viewReferrer?: string | null;
  loadingTimeMs?: number | null;
  lcpMs?: number | null;
  fcpMs?: number | null;
  inpMs?: number | null;
  cls?: number | null;
  timeSpentMs?: number | null;
  // action
  actionType?: string | null;
  actionName?: string | null;
  // error
  errorMessage?: string | null;
  errorSource?: string | null;
  errorStack?: string | null;
  // resource
  resourceUrl?: string | null;
  resourceMethod?: string | null;
  resourceStatus?: number | null;
  resourceDurationMs?: number | null;
  // long task
  longTaskDurationMs?: number | null;
};

export type RumSession = {
  id: string;
  applicationId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: string | null;
  version: string | null;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  viewCount: number;
  actionCount: number;
  errorCount: number;
  frustrationCount: number;
  timeSpentMs: number;
  timeline: RumTimelineEvent[];
};

export type RumErrorGroup = {
  message: string | null;
  source: string | null;
  occurrences: number;
  impactedSessions: number;
  firstSeenMs: number | null;
  lastSeenMs: number | null;
  paths: string[];
  browsers: string[];
};

export type RumViewListItem = {
  ts: number;
  applicationId: string;
  sessionId: string;
  viewId: string;
  viewPath: string | null;
  viewUrl: string | null;
  loadingTimeMs: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  timeSpentMs: number | null;
  userId: string | null;
  userName: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  country: string | null;
  version: string | null;
};

export type RumPerfMetric = "loadingTime" | "lcp" | "fcp" | "inp" | "cls" | "views";
export type RumTimeRange = { fromMs: number; toMs: number };
