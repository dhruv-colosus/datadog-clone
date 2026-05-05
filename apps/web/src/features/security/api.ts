import type {
  ArchiveReason,
  DetectionRule,
  RuleCase,
  RuleSource,
  RuleType,
  SecuritySeverity,
  SecuritySignal,
  SignalStatus,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const securityEndpoints = {
  rules: `${API_URL}/security/rules`,
  rule: (id: string) => `${API_URL}/security/rules/${id}`,
  rulePreview: (id: string) => `${API_URL}/security/rules/${id}/preview`,
  signals: `${API_URL}/security/signals`,
  signal: (id: string) => `${API_URL}/security/signals/${id}`,
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

export type SignalFilters = {
  severity?: string[];
  status?: string[];
  service?: string[];
  rule_id?: string[];
};

function qs(filters?: SignalFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  for (const [k, vs] of Object.entries(filters)) {
    for (const v of vs ?? []) params.append(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listRules(): Promise<DetectionRule[]> {
  const res = await fetch(securityEndpoints.rules, { credentials: "include" });
  return jsonOrThrow<DetectionRule[]>(res, "GET /security/rules");
}

export async function getRule(id: string): Promise<DetectionRule> {
  const res = await fetch(securityEndpoints.rule(id), {
    credentials: "include",
  });
  return jsonOrThrow<DetectionRule>(res, `GET /security/rules/${id}`);
}

export type RulePayload = {
  name: string;
  description?: string | null;
  rule_type?: RuleType;
  source?: RuleSource;
  query?: string;
  cases?: RuleCase[];
  severity_default?: SecuritySeverity;
  enabled?: boolean;
  tags?: string[];
  mitre_tactics?: string[];
};

export async function createRule(payload: RulePayload): Promise<DetectionRule> {
  const res = await fetch(securityEndpoints.rules, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<DetectionRule>(res, "POST /security/rules");
}

export async function updateRule(
  id: string,
  payload: Partial<RulePayload>,
): Promise<DetectionRule> {
  const res = await fetch(securityEndpoints.rule(id), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<DetectionRule>(res, `PUT /security/rules/${id}`);
}

export async function deleteRule(id: string): Promise<void> {
  const res = await fetch(securityEndpoints.rule(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /security/rules/${id} failed: ${res.status}`);
  }
}

export type RulePreview = {
  rule: DetectionRule;
  matches: Array<Record<string, unknown>>;
  matchCount: number;
};

export async function previewRule(id: string): Promise<RulePreview> {
  const res = await fetch(securityEndpoints.rulePreview(id), {
    method: "POST",
    credentials: "include",
  });
  return jsonOrThrow<RulePreview>(res, `POST /security/rules/${id}/preview`);
}

export async function listSignals(
  filters?: SignalFilters,
): Promise<SecuritySignal[]> {
  const res = await fetch(securityEndpoints.signals + qs(filters), {
    credentials: "include",
  });
  return jsonOrThrow<SecuritySignal[]>(res, "GET /security/signals");
}

export async function getSignal(id: string): Promise<SecuritySignal> {
  const res = await fetch(securityEndpoints.signal(id), {
    credentials: "include",
  });
  return jsonOrThrow<SecuritySignal>(res, `GET /security/signals/${id}`);
}

export async function patchSignal(
  id: string,
  payload: { status?: SignalStatus; archive_reason?: ArchiveReason },
): Promise<SecuritySignal> {
  const res = await fetch(securityEndpoints.signal(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<SecuritySignal>(res, `PATCH /security/signals/${id}`);
}
