import type {
  BurnRateAlert,
  BurnRateReading,
  SLO,
  SLOHistory,
  SLOSource,
  SLOType,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const slosEndpoints = {
  list: `${API_URL}/slos`,
  byId: (id: string) => `${API_URL}/slos/${id}`,
  history: (id: string) => `${API_URL}/slos/${id}/history`,
  burnRate: (id: string) => `${API_URL}/slos/${id}/burn-rate`,
  alerts: (id: string) => `${API_URL}/slos/${id}/burn-rate-alerts`,
  alert: (id: string, alertId: string) =>
    `${API_URL}/slos/${id}/burn-rate-alerts/${alertId}`,
};

export type CreateSLOPayload = {
  name: string;
  description?: string | null;
  type: SLOType;
  source: SLOSource;
  target_pct: number;
  warning_pct?: number | null;
  time_window_days: number;
  services?: string[];
  teams?: string[];
  tags?: string[];
  favorite?: boolean;
};

export type PatchSLOPayload = Partial<CreateSLOPayload>;

export type CreateBurnRateAlertPayload = {
  name: string;
  short_window_min: number;
  long_window_min: number;
  burn_threshold: number;
  severity: "warn" | "alert";
  enabled?: boolean;
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

export async function listSLOs(): Promise<SLO[]> {
  const res = await fetch(slosEndpoints.list, { credentials: "include" });
  return jsonOrThrow<SLO[]>(res, "GET /slos");
}

export async function getSLO(id: string): Promise<SLO> {
  const res = await fetch(slosEndpoints.byId(id), { credentials: "include" });
  return jsonOrThrow<SLO>(res, `GET /slos/${id}`);
}

export async function createSLO(payload: CreateSLOPayload): Promise<SLO> {
  const res = await fetch(slosEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<SLO>(res, "POST /slos");
}

export async function patchSLO(
  id: string,
  payload: PatchSLOPayload,
): Promise<SLO> {
  const res = await fetch(slosEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<SLO>(res, `PATCH /slos/${id}`);
}

export async function deleteSLO(id: string): Promise<void> {
  const res = await fetch(slosEndpoints.byId(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`DELETE /slos/${id} failed: ${res.status}`);
  }
}

export async function fetchSLOHistory(id: string): Promise<SLOHistory> {
  const res = await fetch(slosEndpoints.history(id), { credentials: "include" });
  return jsonOrThrow<SLOHistory>(res, `GET /slos/${id}/history`);
}

export async function fetchBurnRate(
  id: string,
): Promise<{ alerts: BurnRateReading[] }> {
  const res = await fetch(slosEndpoints.burnRate(id), { credentials: "include" });
  return jsonOrThrow<{ alerts: BurnRateReading[] }>(
    res,
    `GET /slos/${id}/burn-rate`,
  );
}

export async function listBurnRateAlerts(id: string): Promise<BurnRateAlert[]> {
  const res = await fetch(slosEndpoints.alerts(id), { credentials: "include" });
  return jsonOrThrow<BurnRateAlert[]>(res, `GET /slos/${id}/burn-rate-alerts`);
}

export async function createBurnRateAlert(
  id: string,
  payload: CreateBurnRateAlertPayload,
): Promise<BurnRateAlert> {
  const res = await fetch(slosEndpoints.alerts(id), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<BurnRateAlert>(res, `POST /slos/${id}/burn-rate-alerts`);
}

export async function deleteBurnRateAlert(
  id: string,
  alertId: string,
): Promise<void> {
  const res = await fetch(slosEndpoints.alert(id, alertId), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(
      `DELETE /slos/${id}/burn-rate-alerts/${alertId} failed: ${res.status}`,
    );
  }
}
