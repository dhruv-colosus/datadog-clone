import type { Host, MapSavedQuery } from "./types";

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFor(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function sparkline(seed: number, length = 14, base = 4, amp = 6): number[] {
  const r = rngFor(seed);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    out.push(Math.max(0, base + (r() - 0.4) * amp));
  }
  return out;
}

const PRIMARY_HOST: Host = {
  id: "saas-clone-staging",
  hostname: "saas-clone-staging",
  status: "active",
  os: "linux",
  agentVersion: "7.78.2",
  cpuPercent: 4.67,
  cpuSparkline: sparkline(hashSeed("saas-clone-staging-cpu"), 18, 5, 3),
  iowaitPercent: 0.08,
  iowaitSparkline: sparkline(hashSeed("saas-clone-staging-io"), 18, 0.1, 0.4),
  load15: 0.08,
  apps: ["container", "docker", "ntp", "system"],
  availabilityZone: null,
  region: "nyc3",
  service: null,
  ipAddress: "142.93.203.175",
  ipv6Address: "2604:a880:400:d1:0:4:47aa:e001",
  macAddress: "7e:32:76:42:85:bc",
  cpuCores: 8,
  logicalCores: 8,
  memoryGB: 16.77,
  filesystemGB: 336.41,
  swapTotalGB: 0,
  cpuModelName: "DO-Regular",
  cpuVendor: "GenuineIntel",
  cpuMhz: 2294.614,
  cpuCacheKb: 4096,
  cpuFamily: 6,
  cpuModel: 79,
  cpuStepping: 1,
  kernelName: "Linux",
  kernelRelease: "6.8.0-110-generic",
  kernelVersion: "#110-Ubuntu SMP PREEMPT_DYNAMIC Thu Mar 19 15:09:20 UTC 2026",
  machine: "x86_64",
  processor: "x86_64",
  hardwarePlatform: "x86_64",
  dockerSwarm: "inactive",
  dockerVersion: "29.4.0",
  filesystemMounts: [
    { fs: "tmpfs", mount: "/run/user/0", size: "1.64G" },
    { fs: "tmpfs", mount: "/run", size: "1.64G" },
    { fs: "/dev/vda1", mount: "/", size: "323.94G" },
    { fs: "tmpfs", mount: "/dev/shm", size: "8.39G" },
  ],
  tags: [{ key: "host", value: "saas-clone-staging" }],
  containers: [
    {
      name: "google-slides-clone-api-1",
      status: "up",
      cpuPercent: 0.4,
      cpuMaxPercent: 100,
      rssMib: 86,
      rssMaxMib: 128,
      txBytes: 0,
      rxBytes: 0,
      startedAgo: "4 days",
    },
    {
      name: "datadog-agent",
      status: "up",
      cpuPercent: 0.6,
      cpuMaxPercent: 100,
      rssMib: 80,
      rssMaxMib: 128,
      txBytes: 0,
      rxBytes: 0,
      startedAgo: "3 hours",
    },
    {
      name: "google-slides-clone-web-1",
      status: "up",
      cpuPercent: 0,
      cpuMaxPercent: 100,
      rssMib: 55,
      rssMaxMib: 128,
      txBytes: 0,
      rxBytes: 0,
      startedAgo: "4 days",
    },
    {
      name: "google-slides-clone-caddy-1",
      status: "up",
      cpuPercent: 0.3,
      cpuMaxPercent: 100,
      rssMib: 13,
      rssMaxMib: 128,
      txBytes: 6.74,
      rxBytes: 6.74,
      startedAgo: "12 days",
    },
    {
      name: "google-slides-clone-db-1",
      status: "up",
      cpuPercent: 0.5,
      cpuMaxPercent: 100,
      rssMib: 9,
      rssMaxMib: 128,
      txBytes: 0,
      rxBytes: 0,
      startedAgo: "9 days",
    },
  ],
};

const ZONE_DEFS: { zone: string | null; region: string; count: number }[] = [
  { zone: null, region: "nyc3", count: 394 },
  { zone: "eastus", region: "eastus", count: 183 },
  { zone: "eastus-1", region: "eastus", count: 153 },
  { zone: "northcentralus", region: "centralus", count: 82 },
  { zone: "us-east-1a", region: "us-east-1", count: 75 },
  { zone: "us-east-1b", region: "us-east-1", count: 62 },
  { zone: "westus", region: "westus", count: 37 },
  { zone: "westus2", region: "westus2", count: 36 },
  { zone: "us-east-1c", region: "us-east-1", count: 31 },
  { zone: "us-central1-a", region: "us-central1", count: 28 },
  { zone: "us-central1-c", region: "us-central1", count: 26 },
  { zone: "us-east-1c-2", region: "us-east-1", count: 25 },
  { zone: "us-west3-a", region: "us-west3", count: 25 },
  { zone: "eastus2", region: "eastus2", count: 25 },
  { zone: "us-central1-f", region: "us-central1", count: 23 },
  { zone: "westus2-1", region: "westus2", count: 21 },
  { zone: "centralus", region: "centralus", count: 18 },
  { zone: "eastus2-1", region: "eastus2", count: 17 },
  { zone: "southcentralus", region: "centralus", count: 17 },
  { zone: "ap-northeast-2c", region: "ap-northeast-2", count: 16 },
  { zone: "centralus-1", region: "centralus", count: 15 },
  { zone: "eastus-2", region: "eastus", count: 15 },
  { zone: "japaneast-1", region: "japaneast", count: 14 },
  { zone: "us-west-2a", region: "us-west-2", count: 10 },
  { zone: "us-west-2c", region: "us-west-2", count: 10 },
  { zone: "westeurope", region: "westeurope", count: 9 },
  { zone: "westeurope-1", region: "westeurope", count: 9 },
  { zone: "japaneast", region: "japaneast", count: 9 },
  { zone: "northeurope-1", region: "northeurope", count: 9 },
  { zone: "us-west-2b", region: "us-west-2", count: 8 },
  { zone: "westus3", region: "westus3", count: 8 },
  { zone: "francecentral-1", region: "francecentral", count: 8 },
  { zone: "koreacentral-1", region: "koreacentral", count: 8 },
  { zone: "eastus-3", region: "eastus", count: 7 },
  { zone: "australiaeast", region: "australiaeast", count: 8 },
  { zone: "southeastasia-1", region: "southeastasia", count: 8 },
  { zone: "francecentral", region: "francecentral", count: 6 },
  { zone: "northeurope", region: "northeurope", count: 6 },
  { zone: "southeastasia", region: "southeastasia", count: 6 },
  { zone: "canadacentral", region: "canadacentral", count: 6 },
  { zone: "japaneast-2", region: "japaneast", count: 5 },
  { zone: "europe-west1", region: "europe-west1", count: 5 },
  { zone: "europe-west2", region: "europe-west2", count: 5 },
  { zone: "us-west1-b", region: "us-west1", count: 5 },
  { zone: "us-east-1e", region: "us-east-1", count: 6 },
  { zone: "ukwest", region: "ukwest", count: 4 },
  { zone: "westus3-1", region: "westus3", count: 4 },
  { zone: "canadaeast", region: "canadaeast", count: 4 },
  { zone: "japanwest", region: "japanwest", count: 4 },
  { zone: "australiaeast-2", region: "australiaeast", count: 4 },
];

const SERVICES = [
  "web",
  "api",
  "auth",
  "payments",
  "worker",
  "caddy",
  "postgres",
  "redis",
  null,
];

const APP_POOL = [
  ["container", "docker", "ntp", "system"],
  ["container", "docker", "kubernetes", "system"],
  ["container", "docker", "redis", "system"],
  ["container", "docker", "postgres", "system"],
  ["container", "docker", "nginx", "system"],
  ["agent", "system", "ntp"],
] as const;

function buildHosts(): Host[] {
  const list: Host[] = [PRIMARY_HOST];
  let counter = 0;
  ZONE_DEFS.forEach((z) => {
    const start = z.zone === null ? 1 : 0;
    const zoneKey = z.zone ?? "no-az";
    for (let i = start; i < z.count; i++) {
      counter += 1;
      const seed = hashSeed(`${zoneKey}-${i}`);
      const r = rngFor(seed);
      const cpu = Math.round(r() * 1000) / 10;
      const apps = APP_POOL[seed % APP_POOL.length];
      const status: Host["status"] =
        r() > 0.96 ? "down" : r() > 0.88 ? "warning" : "active";
      const service = SERVICES[seed % SERVICES.length];
      list.push({
        id: `${zoneKey}-${i}`,
        hostname: `i-${(seed >>> 0).toString(16).padStart(8, "0")}`,
        status,
        os: "linux",
        agentVersion: r() > 0.05 ? "7.78.2" : "7.68.0",
        cpuPercent: cpu,
        cpuSparkline: sparkline(seed, 18, cpu / 12 + 1, 4),
        iowaitPercent: Math.round(r() * 200) / 100,
        iowaitSparkline: sparkline(seed + 1, 18, 0.2, 0.6),
        load15: Math.round(r() * 250) / 100,
        apps: [...apps],
        availabilityZone: z.zone,
        region: z.region,
        service,
        ipAddress: `10.${(seed >> 8) & 0xff}.${seed & 0xff}.${counter & 0xff}`,
        ipv6Address: PRIMARY_HOST.ipv6Address,
        macAddress: PRIMARY_HOST.macAddress,
        cpuCores: 4,
        logicalCores: 4,
        memoryGB: 8,
        filesystemGB: 100,
        swapTotalGB: 0,
        cpuModelName: "Intel Xeon",
        cpuVendor: "GenuineIntel",
        cpuMhz: 2400,
        cpuCacheKb: 4096,
        cpuFamily: 6,
        cpuModel: 79,
        cpuStepping: 1,
        kernelName: "Linux",
        kernelRelease: "6.8.0-110-generic",
        kernelVersion: PRIMARY_HOST.kernelVersion,
        machine: "x86_64",
        processor: "x86_64",
        hardwarePlatform: "x86_64",
        dockerSwarm: "inactive",
        dockerVersion: "29.4.0",
        filesystemMounts: PRIMARY_HOST.filesystemMounts,
        tags: [
          { key: "host", value: `i-${(seed >>> 0).toString(16).padStart(8, "0")}` },
          ...(z.zone ? [{ key: "availability-zone", value: z.zone }] : []),
          { key: "region", value: z.region },
          ...(service ? [{ key: "service", value: service }] : []),
        ],
        containers: [],
      });
    }
  });
  return list;
}

export const HOSTS: Host[] = buildHosts();

export const LIST_HOSTS: Host[] = [PRIMARY_HOST];

export const PRIMARY_HOST_ID = PRIMARY_HOST.id;

export function getHost(id: string): Host | undefined {
  return HOSTS.find((h) => h.id === id);
}

export const MAP_SAVED_QUERIES: MapSavedQuery[] = [
  {
    id: "cpu-by-az",
    question: "What is the CPU usage across my infrastructure?",
    meta: "by availability-zone",
  },
  {
    id: "container-cpu",
    question: "What is the CPU usage across containers running on my hosts?",
    meta: "by availability-zone",
  },
  {
    id: "errors-by-infra",
    question: "How many errors are being logged across my infrastructure?",
    meta: "by availability-zone",
  },
  {
    id: "busiest-hosts",
    question: "Which services run on the busiest hosts, and are their pods ready?",
    meta: "by service",
  },
  {
    id: "outdated-agents",
    question: "How many hosts are running on outdated agent versions?",
    meta: "agent_version:<7.69.0 by agent_version",
  },
  {
    id: "unready-pods",
    question: "Which workloads have the most unready pods?",
    meta: "No filters applied",
  },
];

export function buildPanelTimeSeries(
  seed: number,
  length: number,
  base: number,
  amp: number,
  min = 0,
): { t: number; v: number }[] {
  const r = rngFor(seed);
  const now = Date.now();
  const stepMs = (60 * 60 * 1000) / length;
  const out: { t: number; v: number }[] = [];
  let drift = 0;
  for (let i = 0; i < length; i++) {
    drift += (r() - 0.5) * amp * 0.3;
    const wave = Math.sin((i / length) * Math.PI * 4) * amp * 0.3;
    const noise = (r() - 0.5) * amp * 0.4;
    out.push({
      t: now - (length - i) * stepMs,
      v: Math.max(min, base + wave + drift + noise),
    });
  }
  return out;
}
