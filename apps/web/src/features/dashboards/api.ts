import type {
  Dashboard,
  DashboardIcon,
  DashboardKind,
  DashboardShareConfig,
  TemplateVariable,
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
  template_vars?: TemplateVariable[];
  tags?: string[];
  share?: DashboardShareConfig;
};

export type PatchDashboardPayload = Partial<CreateDashboardPayload>;

export type DashboardResponse = Dashboard & {
  ownerId?: string;
  templateVars?: TemplateVariable[];
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

export async function fetchDashboards(): Promise<Dashboard[]> {
  const res = await fetch(dashboardsEndpoints.list, {
    credentials: "include",
  });
  const list = await jsonOrThrow<DashboardResponse[]>(res, "GET /dashboards");
  return list.map(responseToDashboard);
}

export async function fetchDashboard(id: string): Promise<Dashboard> {
  const res = await fetch(dashboardsEndpoints.byId(id), {
    credentials: "include",
  });
  const data = await jsonOrThrow<DashboardResponse>(res, `GET /dashboards/${id}`);
  return responseToDashboard(data);
}

export async function deleteDashboard(id: string): Promise<void> {
  const res = await fetch(dashboardsEndpoints.byId(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /dashboards/${id} failed: ${res.status}`);
  }
}

export async function cloneDashboard(id: string): Promise<DashboardResponse> {
  const res = await fetch(`${dashboardsEndpoints.byId(id)}/clone`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return jsonOrThrow<DashboardResponse>(res, `POST /dashboards/${id}/clone`);
}

export function responseToDashboard(r: DashboardResponse): Dashboard {
  return {
    id: r.id,
    serverId: r.id,
    name: r.name,
    kind: r.kind,
    icon: r.icon as DashboardIcon | undefined,
    author: r.author ?? { name: "Unknown", avatarColor: "#7c8a5b" },
    modifiedMs: r.modifiedMs,
    popularity: r.popularity ?? 0,
    teams: [],
    widgets: r.widgets ?? [],
    share: r.share,
    templateVars: r.templateVars ?? [],
  };
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
