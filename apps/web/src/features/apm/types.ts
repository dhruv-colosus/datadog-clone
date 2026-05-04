export type ApmServiceType = "web" | "db" | "cache" | "custom";

export type ApmHealth = "ok" | "warn" | "critical";

export type ApmServiceLanguage = "python" | "node" | "go" | "java" | "ruby";

export type ApmService = {
  id: string;
  name: string;
  type: ApmServiceType;
  language: ApmServiceLanguage;
  env: string;
  health: ApmHealth;
  requestsPerSec: number;
  errorRate: number | null;
  p50LatencyMs: number;
  p99LatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
  totalErrors: number;
  lastDeployMinutesAgo: number | null;
  team?: string;
  tier?: number;
  description?: string;
  starred?: boolean;
};

export type ApmOperation = {
  name: string;
  hits: number;
  errors: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
};

export type ApmDependency = {
  caller: string;
  callee: string;
  kind: "http" | "db" | "cache" | "queue";
  weight?: number;
};

export type ApmServiceMapNode = {
  service: string;
  type: ApmServiceType;
  language: string;
  team?: string;
  tier?: number;
  hits: number;
  errors: number;
  errorRate: number;
  rps: number;
  p95LatencyMs: number;
};

export type ApmServiceMapEdge = {
  caller: string;
  callee: string;
  calls: number;
  errors: number;
  kind?: "http" | "db" | "cache" | "queue";
};

export type ApmServiceMap = {
  nodes: ApmServiceMapNode[];
  edges: ApmServiceMapEdge[];
};

export type ApmFlameSpan = {
  spanId: string;
  parentSpanId: string | null;
  traceId: string;
  service: string;
  operation: string;
  resource: string;
  durationMs: number;
  tsMs: number;
  status: "ok" | "error";
  httpMethod: string | null;
  httpStatus: number | null;
  host: string | null;
  env: string;
  tags: Record<string, string>;
};

export type ApmTraceDetail = {
  traceId: string;
  spans: ApmFlameSpan[];
  startMs: number;
  endMs: number;
  durationMs: number;
  spanCount: number;
  errorCount: number;
  services: string[];
};

export type ApmSpanStatus = "ok" | "error";

export type ApmSpanMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;

export type ApmSpan = {
  id: string;
  spanId: string;
  traceId: string;
  parentSpanId?: string | null;
  operation?: string;
  timestampMs: number;
  service: string;
  resource: string;
  durationMs: number;
  method: ApmSpanMethod;
  statusCode: number | null;
  status: ApmSpanStatus;
  host?: string | null;
  env?: string;
};

export type ApmResource = {
  id: string;
  name: string;
  service: string;
  requests: number | null;
  totalTimeMs: number;
  p95LatencyMs: number;
  errors: number | null;
  errorRate: number;
};

export type ApmTimeSeriesPoint = {
  t: number;
  hits: number;
  errors: number;
  latencyMs: number;
  p50Ms?: number;
  p95Ms?: number;
  p99Ms?: number;
};

export type ApmServiceSeries = {
  service: string;
  points: ApmTimeSeriesPoint[];
};

export type ApmFacetCount = {
  value: string;
  count: number;
};

export type ApmFacets = {
  status: { value: ApmSpanStatus; count: number }[];
  service: ApmFacetCount[];
  resource: ApmFacetCount[];
  env: ApmFacetCount[];
  total: number;
};

export type ApmSearchToken = {
  id: string;
  key: string;
  value: string;
};

export type ApmTimeRangePreset =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "2d"
  | "1w";

export type ApmTimeRange = {
  preset: ApmTimeRangePreset | "custom";
  fromMs: number;
  toMs: number;
};

export type ApmRecommendation = {
  id: string;
  title: string;
  type: "performance" | "reliability" | "cost";
  service: string;
  description: string;
};

export type ApmWatchdogPoint = {
  t: number;
  hits: number;
  errors: number;
  rate: number;
};

export type ApmWatchdogAnomaly = {
  id: string;
  kind: string;
  status: "active" | "resolved";
  title: string;
  service: string;
  resource: string;
  startedMs: number;
  endedMs: number;
  peakRate: number;
  hits: number;
  errors: number;
  points: ApmWatchdogPoint[];
};

export type ApmIssue = {
  id: string;
  service: string;
  resource: string;
  errorCount: number;
  lastSeenMs: number | null;
  firstSeenMs: number | null;
  httpStatus: number | null;
};

export type ApmTracesVisualization =
  | "list"
  | "timeseries"
  | "top-list"
  | "bar"
  | "table"
  | "point"
  | "tree"
  | "pie"
  | "flow";

export type ApmTracesQuery = {
  text: string;
  services: string[];
  statuses: ApmSpanStatus[];
  resources: string[];
};
