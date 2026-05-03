import type {
  Dashboard,
  MetricQuery,
  Series,
  TimeRange,
} from "./types";

export const MOCK_METRICS: string[] = [
  "system.cpu.user",
  "system.cpu.system",
  "system.cpu.idle",
  "system.cpu.iowait",
  "system.load.1",
  "system.load.5",
  "system.load.15",
  "system.mem.used",
  "system.mem.free",
  "system.mem.usable",
  "system.disk.used",
  "system.disk.free",
  "system.disk.in_use",
  "system.net.bytes_rcvd",
  "system.net.bytes_sent",
  "system.net.packets_in.error",
  "system.net.packets_out.error",
  "system.io.read_bytes",
  "system.io.write_bytes",
  "system.processes.count",
  "kubernetes.cpu.usage.total",
  "kubernetes.memory.usage",
  "kubernetes.memory.working_set",
  "kubernetes.network.rx_bytes",
  "kubernetes.network.tx_bytes",
  "kubernetes.pods.running",
  "docker.cpu.usage",
  "docker.mem.rss",
  "docker.net.bytes_rcvd",
  "docker.net.bytes_sent",
  "trace.servlet.request.hits",
  "trace.servlet.request.errors",
  "trace.servlet.request.duration",
  "aws.ec2.cpuutilization",
  "aws.elb.request_count",
  "aws.elb.latency",
  "aws.rds.cpuutilization",
  "aws.rds.database_connections",
  "redis.mem.used",
  "redis.net.commands",
  "postgresql.connections",
  "postgresql.percent_usage_connections",
  "nginx.net.connections",
  "nginx.net.request_per_s",
];

export const MOCK_TAGS: { tag: string; values: string[] }[] = [
  {
    tag: "host",
    values: [
      "web-01",
      "web-02",
      "web-03",
      "api-01",
      "api-02",
      "db-primary",
      "db-replica",
      "cache-01",
    ],
  },
  {
    tag: "env",
    values: ["prod", "staging", "dev", "qa"],
  },
  {
    tag: "service",
    values: [
      "web",
      "api",
      "auth",
      "payments",
      "worker",
      "caddy",
      "postgres",
      "redis",
    ],
  },
  {
    tag: "region",
    values: ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1"],
  },
  {
    tag: "availability-zone",
    values: ["us-east-1a", "us-east-1b", "us-east-1c"],
  },
  {
    tag: "kube_cluster_name",
    values: ["main", "edge", "analytics"],
  },
  {
    tag: "kube_namespace",
    values: ["default", "kube-system", "monitoring", "ingress"],
  },
  {
    tag: "team",
    values: ["platform", "growth", "billing", "sre"],
  },
  {
    tag: "version",
    values: ["v1.0.0", "v1.1.0", "v1.2.0", "v2.0.0"],
  },
];

export const MOCK_DASHBOARDS: Dashboard[] = [
  { id: "dash-overview", name: "Production Overview" },
  { id: "dash-api", name: "API Health" },
  { id: "dash-infra", name: "Infrastructure Hosts" },
  { id: "dash-checkout", name: "Checkout Funnel" },
  { id: "dash-kube", name: "Kubernetes Cluster" },
];

export const ALL_TAG_KEYS: string[] = MOCK_TAGS.map((t) => t.tag);

export function getValuesForTag(tag: string): string[] {
  return MOCK_TAGS.find((t) => t.tag === tag)?.values ?? [];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function generatePoints(
  seed: number,
  fromMs: number,
  toMs: number,
  pointCount: number,
  baseline: number,
  amplitude: number,
): { t: number; value: number }[] {
  const rand = seededRandom(seed);
  const span = toMs - fromMs;
  const step = span / pointCount;
  const points: { t: number; value: number }[] = [];
  let drift = 0;
  for (let i = 0; i < pointCount; i++) {
    drift += (rand() - 0.5) * amplitude * 0.4;
    const wave =
      Math.sin((i / pointCount) * Math.PI * 4 + seed) * amplitude * 0.5;
    const noise = (rand() - 0.5) * amplitude * 0.3;
    const value = Math.max(0, baseline + wave + drift + noise);
    points.push({ t: fromMs + i * step, value });
  }
  return points;
}

export function generateMockSeries(
  query: MetricQuery,
  range: TimeRange,
  pointCount = 60,
): Series[] {
  if (!query.metricName) return [];

  const baseSeed = hashString(`${query.metricName}::${query.aggregator}`);
  const baseline = 30 + (baseSeed % 60);
  const amplitude = 10 + (baseSeed % 40);

  if (query.groupBy.length === 0) {
    const filterSuffix = query.filters
      .map((f) => `${f.tag}:${f.values.join("|")}`)
      .join(",");
    return [
      {
        queryId: query.id,
        alias: query.alias,
        label: `${query.aggregator}:${query.metricName}{${
          filterSuffix || "*"
        }}`,
        groupTags: {},
        points: generatePoints(
          baseSeed,
          range.fromMs,
          range.toMs,
          pointCount,
          baseline,
          amplitude,
        ),
      },
    ];
  }

  const tag = query.groupBy[0];
  const values = getValuesForTag(tag).slice(0, 6);
  return values.map((v, idx) => ({
    queryId: query.id,
    alias: query.alias,
    label: `${query.aggregator}:${query.metricName}{${tag}:${v}}`,
    groupTags: { [tag]: v },
    points: generatePoints(
      baseSeed + idx * 7919,
      range.fromMs,
      range.toMs,
      pointCount,
      baseline + idx * 5,
      amplitude,
    ),
  }));
}
