export type MonitorStatus = "OK" | "Alert" | "Warn" | "No Data";

export type MonitorPriority = 1 | 2 | 3 | 4 | 5 | null;

export type MonitorPack = "rum" | "host";

export type MonitorType =
  | "metric"
  | "change"
  | "anomaly"
  | "outlier"
  | "forecast"
  | "host"
  | "audit-trail"
  | "ci-tests"
  | "composite"
  | "data-observability"
  | "error-tracking"
  | "event"
  | "integration"
  | "live-process"
  | "llm-observability"
  | "log"
  | "network"
  | "process"
  | "rum"
  | "synthetic-test"
  | "watchdog";

export type MonitorAuthor = {
  name: string;
  avatarColor: string;
};

export type Monitor = {
  id: string;
  name: string;
  status: MonitorStatus;
  priority: MonitorPriority;
  type: MonitorType;
  pack: MonitorPack;
  tags: string[];
  query: string;
  evaluationLabel: string;
  thresholdLabel: string;
  threshold: number;
  source: string;
  createdMs: number;
  author: MonitorAuthor;
  message: string;
  recoveryMessage: string;
  impact: string;
  runbookSteps: string[];
  team: string;
  muted: boolean;
  mutedUntilMs?: number | null;
};

export type MonitorTypeOption = {
  id: MonitorType;
  label: string;
  description: string;
  configureLabel: string;
};
