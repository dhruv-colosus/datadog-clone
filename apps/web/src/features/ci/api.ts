import type {
  CiExecutionDetail,
  CiPipeline,
  CiPipelineExecution,
  CiTestRun,
  CiTestServiceStat,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const ciEndpoints = {
  pipelines: `${API_URL}/ci/pipelines`,
  executions: `${API_URL}/ci/pipeline-executions`,
  execution: (id: string) => `${API_URL}/ci/pipeline-executions/${id}`,
  testRuns: `${API_URL}/ci/test-runs`,
  testServices: `${API_URL}/ci/test-services`,
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

export type ExecutionFilters = {
  status?: string[];
  service?: string[];
  branch?: string;
  pipeline_id?: string;
  error_domain?: string[];
};

function qs(filters?: ExecutionFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) for (const item of v) params.append(k, item);
    else if (v) params.append(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listPipelines(): Promise<CiPipeline[]> {
  const res = await fetch(ciEndpoints.pipelines, { credentials: "include" });
  return jsonOrThrow<CiPipeline[]>(res, "GET /ci/pipelines");
}

export async function listExecutions(
  filters?: ExecutionFilters,
): Promise<CiPipelineExecution[]> {
  const res = await fetch(ciEndpoints.executions + qs(filters), {
    credentials: "include",
  });
  return jsonOrThrow<CiPipelineExecution[]>(res, "GET /ci/pipeline-executions");
}

export async function getExecution(id: string): Promise<CiExecutionDetail> {
  const res = await fetch(ciEndpoints.execution(id), {
    credentials: "include",
  });
  return jsonOrThrow<CiExecutionDetail>(
    res,
    `GET /ci/pipeline-executions/${id}`,
  );
}

export async function listTestRuns(
  executionId?: string,
  status?: string[],
): Promise<CiTestRun[]> {
  const params = new URLSearchParams();
  if (executionId) params.set("execution_id", executionId);
  if (status) for (const s of status) params.append("status", s);
  const url = `${ciEndpoints.testRuns}${
    params.toString() ? `?${params.toString()}` : ""
  }`;
  const res = await fetch(url, { credentials: "include" });
  return jsonOrThrow<CiTestRun[]>(res, "GET /ci/test-runs");
}

export async function listTestServices(
  days = 14,
): Promise<CiTestServiceStat[]> {
  const res = await fetch(`${ciEndpoints.testServices}?days=${days}`, {
    credentials: "include",
  });
  return jsonOrThrow<CiTestServiceStat[]>(res, "GET /ci/test-services");
}
