const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HostProcessDto = {
  pid: number;
  command: string;
  parentPid: number | null;
  startedSecondsAgo: number;
  cpuPercent: number;
  rssMib: number;
};

export type HostDto = {
  id: string;
  hostname: string;
  role: string | null;
  service: string | null;
  env: string | null;
  region: string | null;
  availabilityZone: string | null;
  os: "linux" | "darwin" | "windows";
  cpuPercent: number;
  agentVersion: string;
  cpuCores: number;
  memoryGB: number;
  filesystemGB: number;
  ipAddress: string;
  ipv6Address: string;
  macAddress: string;
  kernelRelease: string;
  kernelVersion: string;
  dockerVersion: string;
  apps: string[];
  kubeClusterName: string | null;
  kubeNamespace: string | null;
  version: string;
  team: string;
  status: "active" | "warning" | "down";
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchHosts(env?: string): Promise<HostDto[]> {
  const qs = env ? `?env=${encodeURIComponent(env)}` : "";
  return getJson<HostDto[]>(`${API_URL}/infra/hosts${qs}`);
}

export async function fetchHostProcesses(hostId: string): Promise<HostProcessDto[]> {
  return getJson<HostProcessDto[]>(
    `${API_URL}/infra/hosts/${encodeURIComponent(hostId)}/processes`,
  );
}
