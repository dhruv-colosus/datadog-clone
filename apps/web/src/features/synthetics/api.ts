import type {
  AlertCondition,
  AuthConfig,
  BrowserConfig,
  DowntimeWindow,
  HttpMethod,
  RetryConfig,
  Subtype,
  SyntheticAssertion,
  SyntheticEvent,
  SyntheticRequest,
  SyntheticResult,
  SyntheticTest,
  TestType,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const syntheticsEndpoints = {
  list: `${API_URL}/synthetics/tests`,
  byId: (id: string) => `${API_URL}/synthetics/tests/${id}`,
  run: (id: string) => `${API_URL}/synthetics/tests/${id}/run`,
  runOnce: `${API_URL}/synthetics/run-once`,
  results: (id: string) => `${API_URL}/synthetics/tests/${id}/results`,
  events: `${API_URL}/synthetics/events`,
};

export type CreateSyntheticPayload = {
  name: string;
  test_type: TestType;
  subtype: Subtype;
  method: HttpMethod;
  url: string;
  request: SyntheticRequest;
  assertions: SyntheticAssertion[];
  browser_config: BrowserConfig;
  auth: AuthConfig;
  retry: RetryConfig;
  alert_condition: AlertCondition;
  monitor_message: string;
  downtimes: DowntimeWindow[];
  locations: string[];
  frequency_seconds: number;
  tags: string[];
  environment?: string | null;
  team?: string | null;
  enabled: boolean;
  favorite?: boolean;
};

export type PatchSyntheticPayload = Partial<CreateSyntheticPayload>;

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

export async function listSyntheticTests(): Promise<SyntheticTest[]> {
  const res = await fetch(syntheticsEndpoints.list, { credentials: "include" });
  return jsonOrThrow<SyntheticTest[]>(res, "GET /synthetics/tests");
}

export async function getSyntheticTest(id: string): Promise<SyntheticTest> {
  const res = await fetch(syntheticsEndpoints.byId(id), {
    credentials: "include",
  });
  return jsonOrThrow<SyntheticTest>(res, `GET /synthetics/tests/${id}`);
}

export async function createSyntheticTest(
  payload: CreateSyntheticPayload,
): Promise<SyntheticTest> {
  const res = await fetch(syntheticsEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<SyntheticTest>(res, "POST /synthetics/tests");
}

export async function patchSyntheticTest(
  id: string,
  payload: PatchSyntheticPayload,
): Promise<SyntheticTest> {
  const res = await fetch(syntheticsEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<SyntheticTest>(res, `PATCH /synthetics/tests/${id}`);
}

export async function deleteSyntheticTest(id: string): Promise<void> {
  const res = await fetch(syntheticsEndpoints.byId(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`DELETE /synthetics/tests/${id} failed: ${res.status}`);
  }
}

export async function runSyntheticTest(id: string): Promise<SyntheticResult[]> {
  const res = await fetch(syntheticsEndpoints.run(id), {
    method: "POST",
    credentials: "include",
  });
  return jsonOrThrow<SyntheticResult[]>(res, `POST /synthetics/tests/${id}/run`);
}

export type RunOncePayload = {
  test_type: TestType;
  method: HttpMethod;
  url: string;
  request: SyntheticRequest;
  assertions: SyntheticAssertion[];
  browser_config?: BrowserConfig;
  auth: AuthConfig;
  locations: string[];
};

export async function runOnce(payload: RunOncePayload): Promise<SyntheticResult[]> {
  const res = await fetch(syntheticsEndpoints.runOnce, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<SyntheticResult[]>(res, "POST /synthetics/run-once");
}

export async function listSyntheticResults(
  id: string,
  limit = 100,
): Promise<SyntheticResult[]> {
  const res = await fetch(`${syntheticsEndpoints.results(id)}?limit=${limit}`, {
    credentials: "include",
  });
  return jsonOrThrow<SyntheticResult[]>(res, `GET /synthetics/tests/${id}/results`);
}

export async function listSyntheticEvents(
  limit = 50,
): Promise<SyntheticEvent[]> {
  const res = await fetch(`${syntheticsEndpoints.events}?limit=${limit}`, {
    credentials: "include",
  });
  return jsonOrThrow<SyntheticEvent[]>(res, "GET /synthetics/events");
}
