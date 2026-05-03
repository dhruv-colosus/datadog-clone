import type {
  Dashboard,
  DashboardKind,
  DashboardShareConfig,
  Widget,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dashboardsEndpoints = {
  list: `${API_URL}/dashboards`,
  byId: (id: string) => `${API_URL}/dashboards/${id}`,
  publicById: (id: string) => `${API_URL}/dashboards/${id}/public`,
};

export type CreateDashboardPayload = {
  name: string;
  kind: DashboardKind;
  widgets?: Widget[];
  layout?: unknown[];
  template_vars?: unknown[];
  tags?: string[];
  share?: DashboardShareConfig;
};

export type PatchDashboardPayload = Partial<CreateDashboardPayload>;

export type DashboardResponse = Dashboard & {
  ownerId?: string;
  templateVars?: unknown[];
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

export async function createDashboard(
  payload: CreateDashboardPayload,
): Promise<DashboardResponse> {
  const res = await fetch(dashboardsEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<DashboardResponse>(res, "POST /dashboards");
}

export async function patchDashboard(
  id: string,
  payload: PatchDashboardPayload,
): Promise<DashboardResponse> {
  const res = await fetch(dashboardsEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<DashboardResponse>(res, `PATCH /dashboards/${id}`);
}

export class PublicDashboardNotFoundError extends Error {
  constructor() {
    super("Public dashboard not found");
    this.name = "PublicDashboardNotFoundError";
  }
}

export async function fetchPublicDashboard(
  id: string,
): Promise<DashboardResponse> {
  const res = await fetch(dashboardsEndpoints.publicById(id));
  if (res.status === 404) {
    throw new PublicDashboardNotFoundError();
  }
  return jsonOrThrow<DashboardResponse>(res, `GET /dashboards/${id}/public`);
}
