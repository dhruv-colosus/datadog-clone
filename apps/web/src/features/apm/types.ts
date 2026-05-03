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
  p99LatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
  totalErrors: number;
  lastDeployMinutesAgo: number | null;
  starred?: boolean;
};

export type ApmSpanStatus = "ok" | "error";

export type ApmSpanMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;

export type ApmSpan = {
  id: string;
  timestampMs: number;
  service: string;
  resource: string;
  durationMs: number;
  method: ApmSpanMethod;
  statusCode: number | null;
  status: ApmSpanStatus;
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
