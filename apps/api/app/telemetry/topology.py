"""Source-of-truth fixture for the seeded synthetic universe.

Every other generator, query, and seed-data payload references the constants in
this module. Service / host / tag names are spelled out exactly once here so
metrics, logs, traces, and infrastructure all correlate (a span on `service:api`
has matching logs on the same service and metrics tagged `service:api`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ServiceType = Literal["web", "db", "cache", "custom"]
ServiceLanguage = Literal["python", "node", "go", "java", "ruby"]
DependencyKind = Literal["http", "db", "cache", "queue"]
MetricType = Literal["gauge", "count", "rate", "distribution"]
HostStatus = Literal["active", "warning", "down"]
HostOS = Literal["linux", "darwin", "windows"]
LogLevel = Literal["info", "warn", "error", "debug"]


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Service:
    name: str
    type: ServiceType
    language: ServiceLanguage | None
    team: str
    tier: int  # 1 = most critical
    repo_url: str
    description: str


SERVICES: tuple[Service, ...] = (
    Service("web", "web", "node", "platform", 1, "git@github.com:demo/web.git",
            "Next.js frontend"),
    Service("api", "web", "python", "platform", 1, "git@github.com:demo/api.git",
            "FastAPI backend"),
    Service("auth", "web", "node", "platform", 1, "git@github.com:demo/auth.git",
            "Session and identity service"),
    Service("payments", "web", "go", "billing", 1, "git@github.com:demo/payments.git",
            "Payment processing"),
    Service("worker", "custom", "python", "platform", 2, "git@github.com:demo/worker.git",
            "Background jobs"),
    Service("caddy", "web", "go", "sre", 1, "git@github.com:demo/edge.git",
            "Edge proxy"),
    Service("postgres", "db", None, "sre", 1, "",
            "Primary database"),
    Service("redis", "cache", None, "sre", 2, "",
            "Cache + ephemeral state"),
)

SERVICE_NAMES: tuple[str, ...] = tuple(s.name for s in SERVICES)
WEB_SERVICE_NAMES: tuple[str, ...] = tuple(
    s.name for s in SERVICES if s.type == "web"
)
ENTRY_SERVICES: tuple[str, ...] = ("caddy", "web")  # spans originate here


# ---------------------------------------------------------------------------
# Service dependencies (drives service map + trace synthesis)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Dependency:
    caller: str
    callee: str
    kind: DependencyKind
    weight: float = 1.0  # relative call frequency


DEPENDENCIES: tuple[Dependency, ...] = (
    Dependency("caddy", "web", "http", 1.0),
    Dependency("caddy", "api", "http", 0.6),
    Dependency("web", "api", "http", 1.0),
    Dependency("api", "auth", "http", 0.8),
    Dependency("api", "payments", "http", 0.3),
    Dependency("api", "postgres", "db", 1.0),
    Dependency("api", "redis", "cache", 0.7),
    Dependency("auth", "postgres", "db", 0.9),
    Dependency("auth", "redis", "cache", 0.8),
    Dependency("payments", "postgres", "db", 1.0),
    Dependency("payments", "worker", "queue", 0.5),
    Dependency("worker", "postgres", "db", 1.0),
    Dependency("worker", "redis", "cache", 0.6),
)


def callees_of(service: str) -> list[Dependency]:
    return [d for d in DEPENDENCIES if d.caller == service]


# ---------------------------------------------------------------------------
# Tag taxonomy
# ---------------------------------------------------------------------------


ENVS: tuple[str, ...] = ("prod", "staging", "dev")
REGIONS: tuple[str, ...] = ("us-east-1", "us-west-2", "eu-west-1")
AZS_BY_REGION: dict[str, tuple[str, ...]] = {
    "us-east-1": ("us-east-1a", "us-east-1b", "us-east-1c"),
    "us-west-2": ("us-west-2a", "us-west-2b"),
    "eu-west-1": ("eu-west-1a", "eu-west-1b"),
}
TEAMS: tuple[str, ...] = ("platform", "billing", "sre", "growth")
VERSIONS: tuple[str, ...] = ("v1.4.0", "v1.4.1", "v1.5.0", "v2.0.0-rc1")
KUBE_CLUSTERS: tuple[str, ...] = ("main", "edge")
KUBE_NAMESPACES: tuple[str, ...] = ("default", "kube-system", "monitoring", "ingress")

# (key, values) — drives /metrics/tag-keys and /metrics/tag-values
TAG_CATALOG: dict[str, tuple[str, ...]] = {
    "env": ENVS,
    "service": SERVICE_NAMES,
    "region": REGIONS,
    "availability-zone": tuple(az for azs in AZS_BY_REGION.values() for az in azs),
    "team": TEAMS,
    "version": VERSIONS,
    "kube_cluster_name": KUBE_CLUSTERS,
    "kube_namespace": KUBE_NAMESPACES,
}


# ---------------------------------------------------------------------------
# Hosts (50 deterministic entries)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Host:
    id: str
    hostname: str
    role: str  # web | api | auth | payments | worker | db | cache | edge
    service: str | None  # canonical service name running on this host
    env: str
    region: str
    availability_zone: str
    os: HostOS
    cpu_cores: int
    memory_gb: float
    filesystem_gb: float
    ip_address: str
    ipv6_address: str
    mac_address: str
    kernel_release: str
    kernel_version: str
    docker_version: str
    agent_version: str
    apps: tuple[str, ...]
    kube_cluster_name: str | None
    kube_namespace: str | None
    version: str
    team: str
    status: HostStatus = "active"


def _build_hosts() -> tuple[Host, ...]:
    """Deterministic 50-host fixture. Stable across restarts."""
    out: list[Host] = []
    role_to_service: dict[str, str | None] = {
        "edge": "caddy",
        "web": "web",
        "api": "api",
        "auth": "auth",
        "payments": "payments",
        "worker": "worker",
        "db": "postgres",
        "cache": "redis",
    }
    # Rough role × env distribution targeting 50 hosts
    distribution: list[tuple[str, str, int]] = [
        # role, env, count
        ("edge", "prod", 2),
        ("edge", "staging", 1),
        ("web", "prod", 6),
        ("web", "staging", 3),
        ("web", "dev", 1),
        ("api", "prod", 8),
        ("api", "staging", 3),
        ("api", "dev", 1),
        ("auth", "prod", 3),
        ("auth", "staging", 2),
        ("payments", "prod", 4),
        ("payments", "staging", 2),
        ("worker", "prod", 4),
        ("worker", "staging", 2),
        ("worker", "dev", 1),
        ("db", "prod", 3),
        ("db", "staging", 1),
        ("cache", "prod", 2),
        ("cache", "staging", 1),
    ]
    counter = 0
    for role, env, count in distribution:
        for i in range(count):
            counter += 1
            region_idx = counter % len(REGIONS)
            region = REGIONS[region_idx]
            azs = AZS_BY_REGION[region]
            az = azs[counter % len(azs)]
            nn = f"{i + 1:02d}"
            hostname = f"{role}-{env}-{region}-{az[-2:]}-{nn}"
            host_id = hostname  # stable id
            os: HostOS = "linux"
            cpu_cores = {"db": 16, "cache": 8, "edge": 4}.get(role, 8)
            mem_gb = {"db": 64.0, "cache": 32.0, "edge": 8.0}.get(role, 16.0)
            fs_gb = {"db": 1000.0, "cache": 50.0}.get(role, 200.0)
            apps_for_role: dict[str, tuple[str, ...]] = {
                "edge": ("system", "agent", "nginx"),
                "web": ("system", "agent", "container", "docker"),
                "api": ("system", "agent", "container", "docker", "kubernetes"),
                "auth": ("system", "agent", "container", "docker"),
                "payments": ("system", "agent", "container", "docker"),
                "worker": ("system", "agent", "container", "docker"),
                "db": ("system", "agent", "postgres"),
                "cache": ("system", "agent", "redis"),
            }
            kube_cluster = "main" if role in ("api", "web", "auth", "payments", "worker") else None
            kube_ns = "default" if kube_cluster else None
            ip_a = (counter % 250) + 1
            ip_b = ((counter * 7) % 250) + 1
            ip_address = f"10.{region_idx}.{ip_b}.{ip_a}"
            ipv6 = f"2604:a880:400:d{region_idx}::{counter:04x}"
            mac = ":".join(f"{(counter * (i + 13)) % 256:02x}" for i in range(6))
            out.append(
                Host(
                    id=host_id,
                    hostname=hostname,
                    role=role,
                    service=role_to_service[role],
                    env=env,
                    region=region,
                    availability_zone=az,
                    os=os,
                    cpu_cores=cpu_cores,
                    memory_gb=mem_gb,
                    filesystem_gb=fs_gb,
                    ip_address=ip_address,
                    ipv6_address=ipv6,
                    mac_address=mac,
                    kernel_release="6.1.0-22-amd64",
                    kernel_version="#1 SMP Debian 6.1.94-1",
                    docker_version="24.0.7",
                    agent_version="7.78.2",
                    apps=apps_for_role[role],
                    kube_cluster_name=kube_cluster,
                    kube_namespace=kube_ns,
                    version=VERSIONS[counter % len(VERSIONS)],
                    team={
                        "edge": "sre",
                        "db": "sre",
                        "cache": "sre",
                        "payments": "billing",
                    }.get(role, "platform"),
                )
            )
    # Pad to exactly 50 if we're under (we should be at 50 already; this guards)
    while len(out) < 50:
        n = len(out) + 1
        out.append(
            Host(
                id=f"misc-prod-us-east-1-1a-{n:02d}",
                hostname=f"misc-prod-us-east-1-1a-{n:02d}",
                role="api",
                service="api",
                env="prod",
                region="us-east-1",
                availability_zone="us-east-1a",
                os="linux",
                cpu_cores=8,
                memory_gb=16.0,
                filesystem_gb=200.0,
                ip_address=f"10.0.99.{n}",
                ipv6_address=f"2604:a880:400:d0::ff{n:02x}",
                mac_address=":".join(f"{(n * (i + 17)) % 256:02x}" for i in range(6)),
                kernel_release="6.1.0-22-amd64",
                kernel_version="#1 SMP Debian 6.1.94-1",
                docker_version="24.0.7",
                agent_version="7.78.2",
                apps=("system", "agent"),
                kube_cluster_name="main",
                kube_namespace="default",
                version="v1.4.0",
                team="platform",
            )
        )
    return tuple(out[:50])


HOSTS: tuple[Host, ...] = _build_hosts()


def hosts_for_service(service: str) -> list[Host]:
    return [h for h in HOSTS if h.service == service]


def hosts_for_role(role: str) -> list[Host]:
    return [h for h in HOSTS if h.role == role]


# ---------------------------------------------------------------------------
# Containers and processes per host
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Container:
    host_id: str
    name: str
    image: str
    runtime: Literal["docker", "containerd"]
    started_seconds_ago: int


@dataclass(frozen=True)
class Process:
    host_id: str
    pid: int
    command: str
    parent_pid: int | None
    started_seconds_ago: int


_DEFAULT_CONTAINERS_BY_ROLE: dict[str, tuple[tuple[str, str], ...]] = {
    "edge": (("caddy", "caddy:2-alpine"), ("agent", "datadog/agent:7.78.2")),
    "web": (("web", "ghcr.io/demo/web:v1.5.0"), ("agent", "datadog/agent:7.78.2")),
    "api": (("api", "ghcr.io/demo/api:v1.5.0"), ("agent", "datadog/agent:7.78.2")),
    "auth": (("auth", "ghcr.io/demo/auth:v1.4.1"), ("agent", "datadog/agent:7.78.2")),
    "payments": (
        ("payments", "ghcr.io/demo/payments:v1.5.0"),
        ("agent", "datadog/agent:7.78.2"),
    ),
    "worker": (
        ("worker", "ghcr.io/demo/worker:v1.5.0"),
        ("agent", "datadog/agent:7.78.2"),
    ),
    "db": (("postgres", "postgres:16-alpine"), ("agent", "datadog/agent:7.78.2")),
    "cache": (("redis", "redis:7-alpine"), ("agent", "datadog/agent:7.78.2")),
}


def containers_for_host(host: Host) -> list[Container]:
    base = _DEFAULT_CONTAINERS_BY_ROLE.get(host.role, ())
    started_offset = (hash(host.id) % 30000) + 1000  # deterministic
    out = []
    for idx, (name, image) in enumerate(base):
        out.append(
            Container(
                host_id=host.id,
                name=name,
                image=image,
                runtime="docker",
                started_seconds_ago=started_offset + idx * 600,
            )
        )
    # Add a couple of sidecars for variety
    if host.role in ("api", "web", "auth", "payments", "worker"):
        out.append(
            Container(
                host_id=host.id,
                name="filebeat",
                image="docker.elastic.co/beats/filebeat:8.10.4",
                runtime="docker",
                started_seconds_ago=started_offset + 1200,
            )
        )
    return out


_PROCESS_TEMPLATES_BY_ROLE: dict[str, tuple[str, ...]] = {
    "edge": ("caddy run --config /etc/caddy/Caddyfile", "datadog-agent run"),
    "web": ("node /app/server.js", "datadog-agent run"),
    "api": (
        "uvicorn app.main:app --host 0.0.0.0 --port 8000",
        "datadog-agent run",
        "alembic upgrade head",
    ),
    "auth": ("node /app/index.js", "datadog-agent run"),
    "payments": ("/app/payments serve --port 8080", "datadog-agent run"),
    "worker": ("python -m app.worker", "datadog-agent run"),
    "db": ("postgres -D /var/lib/postgresql/data", "datadog-agent run"),
    "cache": ("redis-server /etc/redis/redis.conf", "datadog-agent run"),
}


def processes_for_host(host: Host) -> list[Process]:
    base = _PROCESS_TEMPLATES_BY_ROLE.get(host.role, ("datadog-agent run",))
    started_offset = (hash(host.id) % 30000) + 1000
    out: list[Process] = []
    for idx, cmd in enumerate(base):
        out.append(
            Process(
                host_id=host.id,
                pid=1000 + idx * 11 + (hash(host.id) % 7000),
                command=cmd,
                parent_pid=1,
                started_seconds_ago=started_offset + idx * 300,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Metric catalog
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MetricDef:
    name: str
    type: MetricType
    unit: str
    description: str
    # Which hosts/services this metric applies to.
    # If applicable_services is empty, metric applies per-host (system metrics).
    # If applicable_roles is set, restricted to those host roles.
    applicable_services: tuple[str, ...] = ()
    applicable_roles: tuple[str, ...] = ()
    # Generation parameters (used by generators/metrics.py)
    baseline: float = 50.0
    daily_amplitude: float = 20.0
    noise: float = 5.0


METRIC_CATALOG: tuple[MetricDef, ...] = (
    # System / host-level (apply to all hosts)
    MetricDef("system.cpu.user", "gauge", "%", "User-mode CPU", baseline=18, daily_amplitude=12, noise=3),
    MetricDef("system.cpu.system", "gauge", "%", "Kernel-mode CPU", baseline=6, daily_amplitude=4, noise=1),
    MetricDef("system.cpu.idle", "gauge", "%", "Idle CPU", baseline=70, daily_amplitude=15, noise=5),
    MetricDef("system.cpu.iowait", "gauge", "%", "IO-wait CPU", baseline=1.5, daily_amplitude=1.0, noise=0.5),
    MetricDef("system.load.1", "gauge", "load", "1m load avg", baseline=0.6, daily_amplitude=0.5, noise=0.2),
    MetricDef("system.load.5", "gauge", "load", "5m load avg", baseline=0.7, daily_amplitude=0.4, noise=0.15),
    MetricDef("system.load.15", "gauge", "load", "15m load avg", baseline=0.7, daily_amplitude=0.3, noise=0.1),
    MetricDef("system.mem.used", "gauge", "bytes", "Memory used", baseline=8e9, daily_amplitude=2e9, noise=3e8),
    MetricDef("system.mem.free", "gauge", "bytes", "Memory free", baseline=8e9, daily_amplitude=2e9, noise=3e8),
    MetricDef("system.mem.usable", "gauge", "bytes", "Memory usable", baseline=14e9, daily_amplitude=1e9, noise=2e8),
    MetricDef("system.disk.used", "gauge", "bytes", "Disk used", baseline=80e9, daily_amplitude=5e9, noise=1e8),
    MetricDef("system.disk.free", "gauge", "bytes", "Disk free", baseline=120e9, daily_amplitude=5e9, noise=1e8),
    MetricDef("system.disk.in_use", "gauge", "%", "Disk % used", baseline=42, daily_amplitude=8, noise=1),
    MetricDef("system.net.bytes_rcvd", "count", "bytes", "Net bytes received", baseline=2e6, daily_amplitude=1.5e6, noise=3e5),
    MetricDef("system.net.bytes_sent", "count", "bytes", "Net bytes sent", baseline=1.5e6, daily_amplitude=1e6, noise=2e5),
    MetricDef("system.net.packets_in.error", "count", "packets", "Net packet-in errors", baseline=0.3, daily_amplitude=0.3, noise=0.2),
    MetricDef("system.net.packets_out.error", "count", "packets", "Net packet-out errors", baseline=0.2, daily_amplitude=0.2, noise=0.1),
    MetricDef("system.io.read_bytes", "count", "bytes", "Disk read bytes", baseline=1e6, daily_amplitude=8e5, noise=2e5),
    MetricDef("system.io.write_bytes", "count", "bytes", "Disk write bytes", baseline=8e5, daily_amplitude=6e5, noise=1.5e5),
    MetricDef("system.processes.count", "gauge", "processes", "Process count", baseline=180, daily_amplitude=30, noise=8),
    # Kubernetes (kube-tagged hosts only)
    MetricDef("kubernetes.cpu.usage.total", "gauge", "ncpu", "Container CPU", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=0.4, daily_amplitude=0.3, noise=0.1),
    MetricDef("kubernetes.memory.usage", "gauge", "bytes", "Container mem", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=4e8, daily_amplitude=1.5e8, noise=4e7),
    MetricDef("kubernetes.memory.working_set", "gauge", "bytes", "Container working set", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=3.5e8, daily_amplitude=1e8, noise=3e7),
    MetricDef("kubernetes.network.rx_bytes", "count", "bytes", "Pod RX bytes", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=1e6, daily_amplitude=8e5, noise=2e5),
    MetricDef("kubernetes.network.tx_bytes", "count", "bytes", "Pod TX bytes", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=8e5, daily_amplitude=6e5, noise=1.5e5),
    MetricDef("kubernetes.pods.running", "gauge", "pods", "Running pods", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=3, daily_amplitude=2, noise=0.5),
    # Docker
    MetricDef("docker.cpu.usage", "gauge", "%", "Container CPU %", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=22, daily_amplitude=15, noise=4),
    MetricDef("docker.mem.rss", "gauge", "bytes", "Container RSS", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=4e8, daily_amplitude=1.5e8, noise=4e7),
    MetricDef("docker.net.bytes_rcvd", "count", "bytes", "Container RX", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=1e6, daily_amplitude=8e5, noise=2e5),
    MetricDef("docker.net.bytes_sent", "count", "bytes", "Container TX", applicable_roles=("api", "web", "auth", "payments", "worker"), baseline=8e5, daily_amplitude=6e5, noise=1.5e5),
    # APM-derived (per web service)
    MetricDef("trace.servlet.request.hits", "count", "requests", "Request hits", applicable_services=WEB_SERVICE_NAMES, baseline=140, daily_amplitude=80, noise=20),
    MetricDef("trace.servlet.request.errors", "count", "errors", "Request errors", applicable_services=WEB_SERVICE_NAMES, baseline=2, daily_amplitude=2, noise=1),
    MetricDef("trace.servlet.request.duration", "distribution", "ms", "Request duration", applicable_services=WEB_SERVICE_NAMES, baseline=120, daily_amplitude=40, noise=20),
    # Postgres
    MetricDef("postgresql.connections", "gauge", "connections", "Active connections", applicable_services=("postgres",), baseline=42, daily_amplitude=20, noise=4),
    MetricDef("postgresql.percent_usage_connections", "gauge", "%", "Connection pool %", applicable_services=("postgres",), baseline=35, daily_amplitude=15, noise=3),
    # Redis
    MetricDef("redis.mem.used", "gauge", "bytes", "Redis mem used", applicable_services=("redis",), baseline=2e8, daily_amplitude=8e7, noise=2e7),
    MetricDef("redis.net.commands", "count", "commands", "Redis commands/sec", applicable_services=("redis",), baseline=520, daily_amplitude=300, noise=80),
    # AWS-style (a few representative; tagged on hosts directly)
    MetricDef("aws.ec2.cpuutilization", "gauge", "%", "EC2 CPU", baseline=30, daily_amplitude=20, noise=5),
    MetricDef("aws.elb.request_count", "count", "requests", "ELB requests", applicable_services=("caddy",), baseline=200, daily_amplitude=130, noise=30),
    MetricDef("aws.elb.latency", "gauge", "ms", "ELB latency", applicable_services=("caddy",), baseline=42, daily_amplitude=20, noise=8),
    MetricDef("aws.rds.cpuutilization", "gauge", "%", "RDS CPU", applicable_services=("postgres",), baseline=28, daily_amplitude=18, noise=4),
    MetricDef("aws.rds.database_connections", "gauge", "connections", "RDS connections", applicable_services=("postgres",), baseline=42, daily_amplitude=20, noise=4),
    # nginx (caddy edge)
    MetricDef("nginx.net.connections", "gauge", "connections", "Edge connections", applicable_services=("caddy",), baseline=140, daily_amplitude=80, noise=20),
    MetricDef("nginx.net.request_per_s", "rate", "req/s", "Edge req/s", applicable_services=("caddy",), baseline=120, daily_amplitude=70, noise=18),
)

METRIC_NAMES: tuple[str, ...] = tuple(m.name for m in METRIC_CATALOG)
METRICS_BY_NAME: dict[str, MetricDef] = {m.name: m for m in METRIC_CATALOG}


def hosts_for_metric(metric: MetricDef) -> list[Host]:
    """Resolve which hosts a metric should be generated for."""
    if metric.applicable_services:
        out: list[Host] = []
        for h in HOSTS:
            if h.service in metric.applicable_services:
                out.append(h)
        return out
    if metric.applicable_roles:
        return [h for h in HOSTS if h.role in metric.applicable_roles]
    return list(HOSTS)


# ---------------------------------------------------------------------------
# Log templates
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class LogTemplate:
    service: str
    level: LogLevel
    weight: float  # selection weight relative to siblings of same service
    template: str  # may include {placeholder} fields


LOG_TEMPLATES: tuple[LogTemplate, ...] = (
    # api
    LogTemplate("api", "info", 50.0,
                "{method} {path} {status} {latency_ms}ms request_id={req_id}"),
    LogTemplate("api", "info", 8.0,
                "Cache hit key={cache_key} ttl_remaining={ttl}s"),
    LogTemplate("api", "warn", 6.0,
                "Slow request method={method} path={path} duration={latency_ms}ms threshold=500ms"),
    LogTemplate("api", "warn", 3.0,
                "Cache miss key={cache_key} fallback_to=db"),
    LogTemplate("api", "error", 2.0,
                "DB query failed table={table} duration={latency_ms}ms error=\"{err}\""),
    LogTemplate("api", "error", 1.0,
                "Upstream call failed service={upstream} status={upstream_status}"),
    # web
    LogTemplate("web", "info", 60.0,
                "{method} {path} {status} {latency_ms}ms session={session_id}"),
    LogTemplate("web", "warn", 4.0,
                "SSR render slow path={path} duration={latency_ms}ms"),
    LogTemplate("web", "error", 1.5,
                "Render error path={path} component={component} message=\"{err}\""),
    # auth
    LogTemplate("auth", "info", 40.0,
                "Authenticated user_id={user_id} method={auth_method} latency={latency_ms}ms"),
    LogTemplate("auth", "warn", 5.0,
                "Failed login attempt user_id={user_id} ip={client_ip} reason={reason}"),
    LogTemplate("auth", "error", 1.5,
                "Token signing failed kid={kid} error=\"{err}\""),
    # payments
    LogTemplate("payments", "info", 30.0,
                "Charge succeeded amount_cents={amount} currency={currency} txn_id={txn}"),
    LogTemplate("payments", "warn", 4.0,
                "Charge retry attempt={attempt} txn_id={txn} reason={reason}"),
    LogTemplate("payments", "error", 2.0,
                "Charge declined txn_id={txn} reason={reason} provider_status={upstream_status}"),
    # worker
    LogTemplate("worker", "info", 45.0,
                "Job processed kind={job_kind} duration={latency_ms}ms job_id={job_id}"),
    LogTemplate("worker", "warn", 3.0,
                "Job retry attempt={attempt} job_id={job_id} reason={reason}"),
    LogTemplate("worker", "error", 1.5,
                "Job failed job_kind={job_kind} job_id={job_id} error=\"{err}\""),
    # caddy
    LogTemplate("caddy", "info", 70.0,
                "{method} {path} {status} {latency_ms}ms client_ip={client_ip} ua=\"{ua}\""),
    LogTemplate("caddy", "warn", 4.0,
                "Upstream slow service={upstream} path={path} duration={latency_ms}ms"),
    LogTemplate("caddy", "error", 1.0,
                "Upstream unreachable service={upstream} error=\"{err}\""),
    # postgres
    LogTemplate("postgres", "info", 30.0,
                "duration: {latency_ms} ms statement: SELECT * FROM {table} WHERE id = ${id_param}"),
    LogTemplate("postgres", "warn", 3.0,
                "duration: {latency_ms} ms statement: SELECT * FROM {table} -- slow"),
    LogTemplate("postgres", "error", 1.0,
                "ERROR: relation \"{table}\" does not exist at character {col}"),
    # redis
    LogTemplate("redis", "info", 30.0,
                "{op} {key} -> OK ({latency_ms}ms)"),
    LogTemplate("redis", "warn", 2.0,
                "Memory pressure used={used_mb}MB max={max_mb}MB"),
    LogTemplate("redis", "error", 0.5,
                "MISCONF Redis is configured to save RDB snapshots: {err}"),
)


def templates_for_service(service: str) -> list[LogTemplate]:
    return [t for t in LOG_TEMPLATES if t.service == service]


# ---------------------------------------------------------------------------
# Trace operation tree (per service)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Operation:
    service: str
    name: str  # span operation, e.g. "web.request" or "db.query"
    resource_pool: tuple[str, ...]  # candidate resource strings to pick from
    base_latency_ms: float  # lognormal mu (in ms)
    latency_sigma: float  # lognormal sigma
    error_rate: float  # 0..1
    is_entry: bool = False  # only entry ops start a new trace
    http_method_pool: tuple[str, ...] = ()


OPERATIONS: tuple[Operation, ...] = (
    # caddy entry
    Operation("caddy", "edge.request",
              ("GET /", "GET /pricing", "GET /api/users", "POST /api/login",
               "GET /healthz", "POST /api/checkout"),
              base_latency_ms=85, latency_sigma=0.6, error_rate=0.005, is_entry=True,
              http_method_pool=("GET", "POST")),
    # web entry (SSR)
    Operation("web", "web.request",
              ("GET /", "GET /dashboard", "GET /pricing", "GET /settings"),
              base_latency_ms=120, latency_sigma=0.7, error_rate=0.008, is_entry=True,
              http_method_pool=("GET",)),
    # api endpoints (entry from caddy/web, also has internal ops)
    Operation("api", "web.request",
              ("GET /users/:id", "POST /login", "GET /orders", "POST /orders",
               "GET /metrics/series", "GET /healthz"),
              base_latency_ms=110, latency_sigma=0.65, error_rate=0.012, is_entry=True,
              http_method_pool=("GET", "POST", "PATCH", "DELETE")),
    # auth — entry from api
    Operation("auth", "auth.check",
              ("POST /verify", "POST /sign", "GET /jwks"),
              base_latency_ms=22, latency_sigma=0.5, error_rate=0.005,
              http_method_pool=("POST", "GET")),
    # payments — entry from api
    Operation("payments", "payments.charge",
              ("POST /charge", "POST /refund", "GET /subscriptions/:id"),
              base_latency_ms=180, latency_sigma=0.8, error_rate=0.02,
              http_method_pool=("POST", "GET")),
    # worker — internal (called via queue from payments)
    Operation("worker", "queue.consume",
              ("payments.settle", "emails.send", "exports.csv"),
              base_latency_ms=240, latency_sigma=0.9, error_rate=0.015),
    # postgres — leaf
    Operation("postgres", "db.query",
              ("SELECT users", "INSERT orders", "UPDATE sessions", "SELECT JOIN orders+users"),
              base_latency_ms=8, latency_sigma=0.7, error_rate=0.003),
    # redis — leaf
    Operation("redis", "cache.command",
              ("GET", "SET", "DEL", "EXPIRE", "INCR"),
              base_latency_ms=1.5, latency_sigma=0.4, error_rate=0.001),
)

OPERATIONS_BY_SERVICE: dict[str, list[Operation]] = {
    name: [o for o in OPERATIONS if o.service == name]
    for name in SERVICE_NAMES
}


def entry_operations() -> list[Operation]:
    return [o for o in OPERATIONS if o.is_entry]


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Team:
    name: str
    slack_channel: str
    oncall_email: str


TEAM_RECORDS: tuple[Team, ...] = (
    Team("platform", "#platform-oncall", "platform-oncall@example.com"),
    Team("billing", "#billing-oncall", "billing-oncall@example.com"),
    Team("sre", "#sre-oncall", "sre-oncall@example.com"),
    Team("growth", "#growth-eng", "growth-eng@example.com"),
)


# ---------------------------------------------------------------------------
# Convenience summary used by admin reseed status
# ---------------------------------------------------------------------------


def topology_summary() -> dict[str, int]:
    return {
        "services": len(SERVICES),
        "dependencies": len(DEPENDENCIES),
        "hosts": len(HOSTS),
        "metrics": len(METRIC_CATALOG),
        "log_templates": len(LOG_TEMPLATES),
        "operations": len(OPERATIONS),
        "teams": len(TEAM_RECORDS),
    }
