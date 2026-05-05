const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type CostGroupBy =
  | "service"
  | "region"
  | "account"
  | "provider"
  | "resource_type";

export type CostQueryPayload = {
  group_by: CostGroupBy;
  days: number;
  providers?: string[];
  services?: string[];
  regions?: string[];
  accounts?: string[];
};

export type CostQueryResponse = {
  groupBy: CostGroupBy;
  days: number;
  totalCost: number;
  series: Array<Record<string, number | string>>;
  table: Array<{
    bucket: string;
    cost: number;
    previousCost: number;
    changePct: number | null;
  }>;
};

export type CostProvider = {
  provider: string;
  accounts: number;
  totalCost30d: number;
  status: string;
};

export type CostAllocationsResponse = {
  rows: Array<{
    cluster: string;
    namespace: string;
    workload: string;
    cost: number;
  }>;
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

export async function queryCost(
  payload: CostQueryPayload,
): Promise<CostQueryResponse> {
  const res = await fetch(`${API_URL}/cost/query`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<CostQueryResponse>(res, "POST /cost/query");
}

export async function listProviders(): Promise<CostProvider[]> {
  const res = await fetch(`${API_URL}/cost/providers`, {
    credentials: "include",
  });
  return jsonOrThrow<CostProvider[]>(res, "GET /cost/providers");
}

export async function getAllocations(
  days = 30,
): Promise<CostAllocationsResponse> {
  const res = await fetch(`${API_URL}/cost/allocations?days=${days}`, {
    credentials: "include",
  });
  return jsonOrThrow<CostAllocationsResponse>(res, "GET /cost/allocations");
}
