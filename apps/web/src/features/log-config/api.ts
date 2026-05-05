import type {
  LibraryPattern,
  LibraryPipeline,
  LogFacet,
  LogPipeline,
  Processor,
  ScrubberFinding,
  ScrubberRule,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const logConfigEndpoints = {
  pipelines: `${API_URL}/logs/pipelines`,
  pipeline: (id: string) => `${API_URL}/logs/pipelines/${id}`,
  pipelinesLibrary: `${API_URL}/logs/pipelines/library`,
  reorder: `${API_URL}/logs/pipelines/reorder`,
  pipelineTest: (id: string) => `${API_URL}/logs/pipelines/${id}/test`,
  facets: `${API_URL}/logs/facets`,
  facet: (id: string) => `${API_URL}/logs/facets/${id}`,
  scrubberRules: `${API_URL}/security/data-security/rules`,
  scrubberRule: (id: string) => `${API_URL}/security/data-security/rules/${id}`,
  scrubberFindings: `${API_URL}/security/data-security/findings`,
  scrubberLibrary: `${API_URL}/security/data-security/library`,
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

export async function listPipelines(): Promise<LogPipeline[]> {
  const res = await fetch(logConfigEndpoints.pipelines, {
    credentials: "include",
  });
  return jsonOrThrow<LogPipeline[]>(res, "GET /logs/pipelines");
}

export async function getPipeline(id: string): Promise<LogPipeline> {
  const res = await fetch(logConfigEndpoints.pipeline(id), {
    credentials: "include",
  });
  return jsonOrThrow<LogPipeline>(res, `GET /logs/pipelines/${id}`);
}

export async function listPipelineLibrary(): Promise<LibraryPipeline[]> {
  const res = await fetch(logConfigEndpoints.pipelinesLibrary, {
    credentials: "include",
  });
  return jsonOrThrow<LibraryPipeline[]>(res, "GET /logs/pipelines/library");
}

export type PipelinePayload = {
  name: string;
  filter_query?: string;
  processors?: Processor[];
  enabled?: boolean;
  order_index?: number;
};

export async function createPipeline(
  payload: PipelinePayload,
): Promise<LogPipeline> {
  const res = await fetch(logConfigEndpoints.pipelines, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<LogPipeline>(res, "POST /logs/pipelines");
}

export async function updatePipeline(
  id: string,
  payload: Partial<PipelinePayload>,
): Promise<LogPipeline> {
  const res = await fetch(logConfigEndpoints.pipeline(id), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<LogPipeline>(res, `PUT /logs/pipelines/${id}`);
}

export async function deletePipeline(id: string): Promise<void> {
  const res = await fetch(logConfigEndpoints.pipeline(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /logs/pipelines/${id} failed: ${res.status}`);
  }
}

export async function reorderPipelines(ids: string[]): Promise<void> {
  const res = await fetch(logConfigEndpoints.reorder, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    throw new Error(`POST /logs/pipelines/reorder failed: ${res.status}`);
  }
}

export async function testPipeline(
  id: string,
  sample: Record<string, unknown>,
): Promise<{ input: Record<string, unknown>; output: Record<string, unknown> }> {
  const res = await fetch(logConfigEndpoints.pipelineTest(id), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample }),
  });
  return jsonOrThrow(res, `POST /logs/pipelines/${id}/test`);
}

export async function listFacets(): Promise<LogFacet[]> {
  const res = await fetch(logConfigEndpoints.facets, {
    credentials: "include",
  });
  return jsonOrThrow<LogFacet[]>(res, "GET /logs/facets");
}

export async function patchFacet(
  id: string,
  payload: { hidden?: boolean; display_name?: string },
): Promise<LogFacet> {
  const res = await fetch(logConfigEndpoints.facet(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<LogFacet>(res, `PATCH /logs/facets/${id}`);
}

export async function listScrubberRules(): Promise<ScrubberRule[]> {
  const res = await fetch(logConfigEndpoints.scrubberRules, {
    credentials: "include",
  });
  return jsonOrThrow<ScrubberRule[]>(res, "GET /security/data-security/rules");
}

export async function patchScrubberRule(
  id: string,
  payload: Partial<{
    enabled: boolean;
    name: string;
    description: string;
    replacement_strategy: "redact" | "hash" | "partial_redact";
    scope_namespaces: string[];
  }>,
): Promise<ScrubberRule> {
  const res = await fetch(logConfigEndpoints.scrubberRule(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<ScrubberRule>(
    res,
    `PATCH /security/data-security/rules/${id}`,
  );
}

export async function listScrubberFindings(
  days = 7,
  ruleId?: string,
): Promise<ScrubberFinding[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (ruleId) params.set("rule_id", ruleId);
  const res = await fetch(
    `${logConfigEndpoints.scrubberFindings}?${params.toString()}`,
    { credentials: "include" },
  );
  return jsonOrThrow<ScrubberFinding[]>(res, "GET /security/data-security/findings");
}

export async function getLibraryPatterns(): Promise<{ patterns: LibraryPattern[] }> {
  const res = await fetch(logConfigEndpoints.scrubberLibrary, {
    credentials: "include",
  });
  return jsonOrThrow<{ patterns: LibraryPattern[] }>(
    res,
    "GET /security/data-security/library",
  );
}
