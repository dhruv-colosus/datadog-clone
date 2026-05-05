export type SecuritySeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type SignalStatus = "open" | "under_review" | "archived";
export type ArchiveReason = "tp_malicious" | "tp_benign" | "fp_other";
export type RuleType = "log_signature" | "threshold" | "new_term" | "anomaly";
export type RuleSource = "logs" | "spans" | "audit";

export type RuleCase = {
  name: string;
  condition: string;
  severity: SecuritySeverity;
};

export type DetectionRule = {
  id: string;
  name: string;
  description: string | null;
  ruleType: RuleType;
  source: RuleSource;
  query: string;
  cases: RuleCase[];
  severityDefault: SecuritySeverity;
  enabled: boolean;
  tags: string[];
  mitreTactics: string[];
  createdMs: number;
  updatedMs: number;
};

export type SecuritySignal = {
  id: string;
  ruleId: string;
  title: string;
  severity: SecuritySeverity;
  status: SignalStatus;
  archiveReason: ArchiveReason | null;
  affectedService: string | null;
  affectedHost: string | null;
  affectedUser: string | null;
  sourceEventIds: unknown[];
  evidence: Record<string, unknown>;
  mitreTactics: string[];
  createdMs: number;
  triagedMs: number | null;
};
