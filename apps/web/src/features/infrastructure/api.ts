const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HostProcessDto = {
  pid: number;
  command: string;
  parentPid: number | null;
  startedSecondsAgo: number;
  cpuPercent: number;
  rssMib: number;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchHostProcesses(hostId: string): Promise<HostProcessDto[]> {
  return getJson<HostProcessDto[]>(
    `${API_URL}/infra/hosts/${encodeURIComponent(hostId)}/processes`,
  );
}
