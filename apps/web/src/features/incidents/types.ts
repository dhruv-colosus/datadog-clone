export type IncidentSeverity = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4" | "SEV-5";
export type IncidentStatus = "active" | "stable" | "resolved" | "completed";

export type TimelineKind =
  | "state_change"
  | "comment"
  | "integration"
  | "task_added"
  | "role_assigned"
  | "severity_change";

export type TaskStatus = "open" | "in_progress" | "done";

export type IncidentTimelineEntry = {
  id: string;
  incidentId: string;
  kind: TimelineKind;
  actorUserId: number | null;
  actorLabel: string | null;
  payload: Record<string, unknown>;
  occurredMs: number;
};

export type IncidentTask = {
  id: string;
  incidentId: string;
  title: string;
  status: TaskStatus;
  assigneeUserId: number | null;
  assigneeLabel: string | null;
  createdMs: number;
  completedMs: number | null;
};

export type IncidentPostmortem = {
  id: string;
  incidentId: string;
  content: string;
  status: "draft" | "published";
  templateUsed: string;
  createdMs: number;
  updatedMs: number;
};

export type Incident = {
  id: string;
  displayId: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string | null;
  rootCause: string | null;
  customerImpact: string | null;
  detectedVia: string | null;
  affectedServices: string[];
  commanderUserId: number | null;
  commsUserId: number | null;
  createdBy: number | null;
  createdMs: number;
  resolvedMs: number | null;
  completedMs: number | null;
  updatedMs: number;
  timeline?: IncidentTimelineEntry[];
  tasks?: IncidentTask[];
  postmortem?: IncidentPostmortem | null;
};
