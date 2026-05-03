export type HostStatus = "active" | "warning" | "down";

export type HostApp =
  | "container"
  | "docker"
  | "ntp"
  | "system"
  | "agent"
  | "kubernetes"
  | "redis"
  | "postgres"
  | "nginx";

export type FilesystemMount = {
  fs: string;
  mount: string;
  size: string;
};

export type ContainerStatus = "up" | "down" | "exited";

export type HostContainer = {
  name: string;
  status: ContainerStatus;
  cpuPercent: number;
  cpuMaxPercent: number;
  rssMib: number;
  rssMaxMib: number;
  txBytes: number;
  rxBytes: number;
  startedAgo: string;
};

export type Host = {
  id: string;
  hostname: string;
  status: HostStatus;
  os: "linux" | "darwin" | "windows";
  agentVersion: string;
  cpuPercent: number;
  cpuSparkline: number[];
  iowaitPercent: number;
  iowaitSparkline: number[];
  load15: number;
  apps: HostApp[];
  availabilityZone: string | null;
  region: string;
  service: string | null;
  ipAddress: string;
  ipv6Address: string;
  macAddress: string;
  cpuCores: number;
  logicalCores: number;
  memoryGB: number;
  filesystemGB: number;
  swapTotalGB: number;
  cpuModelName: string;
  cpuVendor: string;
  cpuMhz: number;
  cpuCacheKb: number;
  cpuFamily: number;
  cpuModel: number;
  cpuStepping: number;
  kernelName: string;
  kernelRelease: string;
  kernelVersion: string;
  machine: string;
  processor: string;
  hardwarePlatform: string;
  dockerSwarm: "active" | "inactive";
  dockerVersion: string;
  filesystemMounts: FilesystemMount[];
  tags: { key: string; value: string }[];
  containers: HostContainer[];
};

export type HostInfoTabId =
  | "host-info"
  | "metrics"
  | "containers"
  | "processes"
  | "network"
  | "logs"
  | "traces"
  | "profiles"
  | "security";

export type MapMainResource = "Host" | "Container" | "Process";

export type MapFillBy =
  | "CPU usage"
  | "Memory usage"
  | "Disk usage"
  | "Load 15"
  | "IOWait";

export type MapGroupBy =
  | "tags.availability-zone"
  | "tags.region"
  | "tags.service"
  | "tags.env"
  | "none";

export type MapSavedQuery = {
  id: string;
  question: string;
  meta: string;
};
