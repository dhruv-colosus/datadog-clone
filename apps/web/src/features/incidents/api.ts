import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  TaskStatus,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const incidentsEndpoints = {
  list: `${API_URL}/incidents`,
  byId: (id: string) => `${API_URL}/incidents/${id}`,
  fromMonitor: (mid: string) => `${API_URL}/incidents/from-monitor/${mid}`,
  timeline: (id: string) => `${API_URL}/incidents/${id}/timeline`,
  tasks: (id: string) => `${API_URL}/incidents/${id}/tasks`,
  task: (id: string, tid: string) => `${API_URL}/incidents/${id}/tasks/${tid}`,
  postmortem: (id: string) => `${API_URL}/incidents/${id}/postmortem`,
};

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ? ` — ${body.detail}` : "";
    } catch {
      // ignore
    }
    throw new Error(`${label} failed: ${res.status} ${res.statusText}${detail}`);
  }
  return res.json() as Promise<T>;
}

export type IncidentFilters = {
  severity?: string[];
  status?: string[];
  service?: string[];
};

function buildQuery(filters: IncidentFilters | undefined): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  for (const [k, vs] of Object.entries(filters)) {
    for (const v of vs ?? []) params.append(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listIncidents(
  filters?: IncidentFilters,
): Promise<Incident[]> {
  const res = await fetch(incidentsEndpoints.list + buildQuery(filters), {
    credentials: "include",
  });
  return jsonOrThrow<Incident[]>(res, "GET /incidents");
}

export async function getIncident(id: string): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.byId(id), {
    credentials: "include",
  });
  return jsonOrThrow<Incident>(res, `GET /incidents/${id}`);
}

export type DeclareIncidentPayload = {
  title: string;
  severity?: IncidentSeverity;
  summary?: string | null;
  customer_impact?: string | null;
  affected_services?: string[];
  detected_via?: string | null;
};

export async function declareIncident(
  payload: DeclareIncidentPayload,
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Incident>(res, "POST /incidents");
}

export async function declareFromMonitor(
  monitorId: string,
  overrides?: Partial<DeclareIncidentPayload>,
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.fromMonitor(monitorId), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overrides ?? {}),
  });
  return jsonOrThrow<Incident>(
    res,
    `POST /incidents/from-monitor/${monitorId}`,
  );
}

export type PatchIncidentPayload = Partial<{
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string;
  root_cause: string;
  customer_impact: string;
  affected_services: string[];
  commander_user_id: number;
  comms_user_id: number;
}>;

export async function patchIncident(
  id: string,
  payload: PatchIncidentPayload,
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Incident>(res, `PATCH /incidents/${id}`);
}

export async function postTimeline(
  id: string,
  payload: { kind?: string; payload: Record<string, unknown> },
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.timeline(id), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: payload.kind ?? "comment", payload: payload.payload }),
  });
  return jsonOrThrow<Incident>(res, `POST /incidents/${id}/timeline`);
}

export async function createTask(
  id: string,
  payload: { title: string; assignee_label?: string | null },
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.tasks(id), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Incident>(res, `POST /incidents/${id}/tasks`);
}

export async function patchTask(
  id: string,
  taskId: string,
  payload: { status?: TaskStatus; title?: string },
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.task(id, taskId), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Incident>(
    res,
    `PATCH /incidents/${id}/tasks/${taskId}`,
  );
}

export async function upsertPostmortem(
  id: string,
  payload: { content: string; status?: "draft" | "published"; template_used?: string },
): Promise<Incident> {
  const res = await fetch(incidentsEndpoints.postmortem(id), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Incident>(res, `PUT /incidents/${id}/postmortem`);
}
