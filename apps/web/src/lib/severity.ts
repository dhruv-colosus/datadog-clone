export type SeverityLevel =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type IncidentSeverity = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4" | "SEV-5";

export const SEVERITY_LEVELS: SeverityLevel[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "SEV-1",
  "SEV-2",
  "SEV-3",
  "SEV-4",
  "SEV-5",
];

export const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  critical: "#d32f2f",
  high: "#ff9800",
  medium: "#fdd835",
  low: "#1e88e5",
  info: "#9e9e9e",
};

export const SEVERITY_BG: Record<SeverityLevel, string> = {
  critical: "#fde7e7",
  high: "#fff1e0",
  medium: "#fff9d9",
  low: "#e6f0fa",
  info: "#f1f3f4",
};

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const SEVERITY_RANK: Record<SeverityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

const INCIDENT_TO_LEVEL: Record<IncidentSeverity, SeverityLevel> = {
  "SEV-1": "critical",
  "SEV-2": "high",
  "SEV-3": "medium",
  "SEV-4": "low",
  "SEV-5": "info",
};

export function levelForIncidentSeverity(sev: IncidentSeverity): SeverityLevel {
  return INCIDENT_TO_LEVEL[sev];
}

export function compareSeverity(a: SeverityLevel, b: SeverityLevel): number {
  return SEVERITY_RANK[b] - SEVERITY_RANK[a];
}

export type StatusKind =
  | "active"
  | "stable"
  | "resolved"
  | "completed"
  | "open"
  | "under_review"
  | "archived"
  | "success"
  | "failure"
  | "canceled"
  | "running"
  | "skipped"
  | "passed"
  | "failed"
  | "flaky"
  | "acknowledged";

export const STATUS_COLOR: Record<StatusKind, { fg: string; bg: string }> = {
  active: { fg: "#d32f2f", bg: "#fde7e7" },
  stable: { fg: "#a07000", bg: "#fff9d9" },
  resolved: { fg: "#137333", bg: "#e1f3e6" },
  completed: { fg: "#5f6368", bg: "#f1f3f4" },
  open: { fg: "#d32f2f", bg: "#fde7e7" },
  under_review: { fg: "#1e88e5", bg: "#e6f0fa" },
  archived: { fg: "#5f6368", bg: "#f1f3f4" },
  success: { fg: "#137333", bg: "#e1f3e6" },
  failure: { fg: "#d32f2f", bg: "#fde7e7" },
  canceled: { fg: "#5f6368", bg: "#f1f3f4" },
  running: { fg: "#1e88e5", bg: "#e6f0fa" },
  skipped: { fg: "#9aa0a6", bg: "#f8f9fa" },
  passed: { fg: "#137333", bg: "#e1f3e6" },
  failed: { fg: "#d32f2f", bg: "#fde7e7" },
  flaky: { fg: "#a07000", bg: "#fff9d9" },
  acknowledged: { fg: "#1e88e5", bg: "#e6f0fa" },
};

export const STATUS_LABEL: Record<StatusKind, string> = {
  active: "Active",
  stable: "Stable",
  resolved: "Resolved",
  completed: "Completed",
  open: "Open",
  under_review: "Under Review",
  archived: "Archived",
  success: "Success",
  failure: "Failure",
  canceled: "Canceled",
  running: "Running",
  skipped: "Skipped",
  passed: "Passed",
  failed: "Failed",
  flaky: "Flaky",
  acknowledged: "Acknowledged",
};

export const DATADOG_PURPLE = "#1a73e8";
export const DATADOG_PURPLE_BG = "#e8f0fe";
