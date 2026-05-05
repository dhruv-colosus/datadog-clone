export type WatchdogKind =
  | "anomaly"
  | "outlier"
  | "deployment_regression"
  | "deviation";

export type WatchdogSeverity = "high" | "medium" | "low";

export type WatchdogStatus = "active" | "acknowledged" | "resolved";

export type WatchdogPoint = {
  ts: number;
  value: number | null;
};

export type WatchdogEvidence = {
  points?: WatchdogPoint[];
  baseline?: number;
  upper?: number;
  lower?: number;
  sigmas?: number;
  currentValue?: number;
  metricLabel?: string;
};

export type WatchdogStory = {
  id: string;
  kind: WatchdogKind;
  title: string;
  narrative: string;
  severity: WatchdogSeverity;
  status: WatchdogStatus;
  service: string;
  host: string | null;
  metric: string | null;
  evidence: WatchdogEvidence;
  startedMs: number;
  endedMs: number | null;
  createdMs: number;
};
