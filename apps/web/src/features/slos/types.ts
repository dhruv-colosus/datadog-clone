import type { Filter } from "@/features/metrics/types";

export type SLOType = "metric" | "monitor" | "time_slice";

export type SLOStatus = "ok" | "warn" | "breached" | "no_data";

export type Comparator = "<" | "<=" | ">" | ">=";

export type SLOMetricQuery = {
  metricName: string;
  filters: Filter[];
};

export type SLOSourceMetric = {
  goodQuery: SLOMetricQuery;
  totalQuery: SLOMetricQuery;
  useBadEvents: boolean;
  badQuery: SLOMetricQuery;
};

export type SLOSourceMonitor = {
  monitorIds: string[];
};

export type SLOSourceTimeSlice = {
  query: SLOMetricQuery;
  comparator: Comparator;
  threshold: number;
};

export type SLOSource = SLOSourceMetric | SLOSourceMonitor | SLOSourceTimeSlice;

export type SLOEvaluation = {
  status: SLOStatus;
  sliPct: number | null;
  good: number;
  total: number;
  bad: number;
  errorBudgetRemainingPct: number | null;
  error?: string;
};

export type SLO = {
  id: string;
  name: string;
  description: string | null;
  type: SLOType;
  source: SLOSource;
  targetPct: number;
  warningPct: number | null;
  timeWindowDays: number;
  services: string[];
  teams: string[];
  tags: string[];
  favorite: boolean;
  ownerId?: number;
  ownerName?: string | null;
  createdMs: number;
  modifiedMs: number;
  evaluation?: SLOEvaluation;
};

export type SLOHistoryPoint = {
  t: number;
  sliPct: number | null;
  errorBudgetRemainingPct: number | null;
  goodCum: number;
  totalCum: number;
};

export type SLOHistory = {
  stepSeconds: number;
  fromMs: number;
  toMs: number;
  points: SLOHistoryPoint[];
};

export type BurnRateAlert = {
  id: string;
  name: string;
  shortWindowMin: number;
  longWindowMin: number;
  burnThreshold: number;
  severity: "warn" | "alert";
  enabled: boolean;
  createdMs: number;
};

export type BurnRateReading = {
  alertId: string;
  name: string;
  window: "short" | "long";
  windowMin: number;
  burnRate: number | null;
  threshold: number;
  severity: "warn" | "alert";
  enabled: boolean;
  firing: boolean;
};

export function emptyMetricQuery(): SLOMetricQuery {
  return { metricName: "", filters: [] };
}

export function emptyMetricSource(): SLOSourceMetric {
  return {
    goodQuery: emptyMetricQuery(),
    totalQuery: emptyMetricQuery(),
    useBadEvents: true,
    badQuery: emptyMetricQuery(),
  };
}

export function emptyMonitorSource(): SLOSourceMonitor {
  return { monitorIds: [] };
}

export function emptyTimeSliceSource(): SLOSourceTimeSlice {
  return {
    query: emptyMetricQuery(),
    comparator: "<",
    threshold: 0,
  };
}

export function emptySource(type: SLOType): SLOSource {
  switch (type) {
    case "metric":
      return emptyMetricSource();
    case "monitor":
      return emptyMonitorSource();
    case "time_slice":
      return emptyTimeSliceSource();
  }
}

export function statusLabel(status: SLOStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warn":
      return "Warn";
    case "breached":
      return "Breached";
    case "no_data":
      return "No Data";
  }
}

export function statusColor(status: SLOStatus): string {
  switch (status) {
    case "ok":
      return "#137333";
    case "warn":
      return "#f9ab00";
    case "breached":
      return "#d93025";
    case "no_data":
      return "#9aa0a6";
  }
}

export function statusBg(status: SLOStatus): string {
  switch (status) {
    case "ok":
      return "#e6f4ea";
    case "warn":
      return "#fef7e0";
    case "breached":
      return "#fce8e6";
    case "no_data":
      return "#f1f3f4";
  }
}
