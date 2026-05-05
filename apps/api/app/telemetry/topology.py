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
# Hosts (5 deterministic entries — one per major role: api, web, worker, db,
# cache. Other services like auth/payments/caddy share these hosts at the
# trace/log level; they don't get dedicated rows in `topology_hosts`.)
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
    """Deterministic host fixture. Stable across restarts.

    One prod host per service so the canonical 8-service set is fully
    representable on env=prod (default for APM/infra views), plus the pinned
    `saas-clone-staging` host the frontend's HostList opens by default.
    Without prod hosts for api/auth/payments/caddy, spans for those services
    inherit env=staging from the pinned host and disappear from env=prod
    dashboards.
    """
    return (
        # Pinned host the frontend's HostList opens by default. Keeps the
        # detail panel functional against real DB data.
        Host(
            id="saas-clone-staging",
            hostname="saas-clone-staging",
            role="api",
            service="api",
            env="staging",
            region="us-east-1",
            availability_zone="us-east-1a",
            os="linux",
            cpu_cores=8,
            memory_gb=16.0,
            filesystem_gb=336.0,
            ip_address="142.93.203.175",
            ipv6_address="2604:a880:400:d1:0:4:47aa:e001",
            mac_address="7e:32:76:42:85:bc",
            kernel_release="6.8.0-110-generic",
            kernel_version="#110-Ubuntu SMP PREEMPT_DYNAMIC Thu Mar 19 15:09:20 UTC 2026",
            docker_version="29.4.0",
            agent_version="7.78.2",
            apps=("system", "agent", "container", "docker"),
            kube_cluster_name=None,
            kube_namespace=None,
            version="v1.5.0",
            team="platform",
        ),
        Host(
            id="api-prod-us-east-1a-01",
            hostname="api-prod-us-east-1a-01",
            role="api",
            service="api",
            env="prod",
            region="us-east-1",
            availability_zone="us-east-1a",
            os="linux",
            cpu_cores=8,
            memory_gb=16.0,
            filesystem_gb=200.0,
            ip_address="10.0.20.31",
            ipv6_address="2604:a880:400:d0::0011",
            mac_address="4a:5b:6c:7d:8e:9f",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "container", "docker", "kubernetes"),
            kube_cluster_name="main",
            kube_namespace="default",
            version="v1.5.0",
            team="platform",
        ),
        Host(
            id="caddy-prod-us-east-1a-01",
            hostname="caddy-prod-us-east-1a-01",
            role="edge",
            service="caddy",
            env="prod",
            region="us-east-1",
            availability_zone="us-east-1a",
            os="linux",
            cpu_cores=4,
            memory_gb=8.0,
            filesystem_gb=200.0,
            ip_address="10.0.5.10",
            ipv6_address="2604:a880:400:d0::0005",
            mac_address="5a:6b:7c:8d:9e:af",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "nginx"),
            kube_cluster_name=None,
            kube_namespace=None,
            version="v1.5.0",
            team="sre",
        ),
        Host(
            id="auth-prod-us-east-1b-01",
            hostname="auth-prod-us-east-1b-01",
            role="auth",
            service="auth",
            env="prod",
            region="us-east-1",
            availability_zone="us-east-1b",
            os="linux",
            cpu_cores=8,
            memory_gb=16.0,
            filesystem_gb=200.0,
            ip_address="10.0.50.12",
            ipv6_address="2604:a880:400:d0::0006",
            mac_address="6a:7b:8c:9d:ae:bf",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "container", "docker"),
            kube_cluster_name="main",
            kube_namespace="default",
            version="v1.4.1",
            team="platform",
        ),
        Host(
            id="payments-prod-us-west-2a-01",
            hostname="payments-prod-us-west-2a-01",
            role="payments",
            service="payments",
            env="prod",
            region="us-west-2",
            availability_zone="us-west-2a",
            os="linux",
            cpu_cores=8,
            memory_gb=16.0,
            filesystem_gb=200.0,
            ip_address="10.1.60.18",
            ipv6_address="2604:a880:400:d1::0007",
            mac_address="7a:8b:9c:ad:be:cf",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "container", "docker"),
            kube_cluster_name="main",
            kube_namespace="default",
            version="v1.5.0",
            team="billing",
        ),
        Host(
            id="web-prod-us-east-1a-01",
            hostname="web-prod-us-east-1a-01",
            role="web",
            service="web",
            env="prod",
            region="us-east-1",
            availability_zone="us-east-1a",
            os="linux",
            cpu_cores=8,
            memory_gb=16.0,
            filesystem_gb=200.0,
            ip_address="10.0.10.21",
            ipv6_address="2604:a880:400:d0::0001",
            mac_address="0a:1b:2c:3d:4e:5f",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "container", "docker"),
            kube_cluster_name="main",
            kube_namespace="default",
            version="v1.5.0",
            team="platform",
        ),
        Host(
            id="worker-prod-us-west-2a-01",
            hostname="worker-prod-us-west-2a-01",
            role="worker",
            service="worker",
            env="prod",
            region="us-west-2",
            availability_zone="us-west-2a",
            os="linux",
            cpu_cores=8,
            memory_gb=16.0,
            filesystem_gb=200.0,
            ip_address="10.1.20.42",
            ipv6_address="2604:a880:400:d1::0002",
            mac_address="1a:2b:3c:4d:5e:6f",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "container", "docker"),
            kube_cluster_name="main",
            kube_namespace="default",
            version="v1.4.1",
            team="platform",
        ),
        Host(
            id="postgres-prod-us-east-1b-01",
            hostname="postgres-prod-us-east-1b-01",
            role="db",
            service="postgres",
            env="prod",
            region="us-east-1",
            availability_zone="us-east-1b",
            os="linux",
            cpu_cores=16,
            memory_gb=64.0,
            filesystem_gb=1000.0,
            ip_address="10.0.30.10",
            ipv6_address="2604:a880:400:d0::0003",
            mac_address="2a:3b:4c:5d:6e:7f",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "postgres"),
            kube_cluster_name=None,
            kube_namespace=None,
            version="v1.5.0",
            team="sre",
        ),
        Host(
            id="redis-prod-eu-west-1a-01",
            hostname="redis-prod-eu-west-1a-01",
            role="cache",
            service="redis",
            env="prod",
            region="eu-west-1",
            availability_zone="eu-west-1a",
            os="linux",
            cpu_cores=8,
            memory_gb=32.0,
            filesystem_gb=50.0,
            ip_address="10.2.40.7",
            ipv6_address="2604:a880:400:d2::0004",
            mac_address="3a:4b:5c:6d:7e:8f",
            kernel_release="6.1.0-22-amd64",
            kernel_version="#1 SMP Debian 6.1.94-1",
            docker_version="24.0.7",
            agent_version="7.78.2",
            apps=("system", "agent", "redis"),
            kube_cluster_name=None,
            kube_namespace=None,
            version="v1.5.0",
            team="sre",
        ),
    )


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
    cpu_percent: float
    rss_mib: int


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


# (command, baseline_rss_mib, baseline_cpu_percent)
ProcessTemplate = tuple[str, int, float]

_BASELINE_PROCESSES: tuple[ProcessTemplate, ...] = (
    ("systemd --system --deserialize=72", 13, 0.0),
    ("systemd-journald", 56, 0.0),
    ("systemd-resolved", 11, 0.0),
    ("systemd-networkd", 9, 0.0),
    ("systemd-logind", 8, 0.0),
    ("systemd-udevd", 7, 0.0),
    ("dbus-daemon --system --address=systemd: --nofork", 6, 0.0),
    ("cron -f", 4, 0.0),
    ("rsyslogd -n", 5, 0.0),
    ("sshd: /usr/sbin/sshd -D", 9, 0.0),
    ("multipathd -d -s", 27, 0.0),
    ("fwupd", 68, 0.0),
    ("polkitd --no-debug", 12, 0.0),
    ("agent run -p /opt/datadog-agent/run/agent.pid", 129, 0.4),
    (
        "trace-agent --config /etc/datadog-agent/datadog.yaml "
        "--pidfile /opt/datadog-agent/run/trace-agent.pid",
        54,
        0.3,
    ),
    (
        "process-agent --config=/etc/datadog-agent/datadog.yaml "
        "--pid=/opt/datadog-agent/run/process-agent.pid",
        46,
        0.2,
    ),
    (
        "installer run -c /etc/datadog-agent "
        "-p /opt/datadog-agent/run/installer.pid",
        29,
        0.0,
    ),
    ("python3 -u bin/WALinuxAgent-2.15.1.3-py3.12.egg -run-exthandlers", 31, 0.1),
)

_ROLE_PROCESSES: dict[str, tuple[ProcessTemplate, ...]] = {
    "edge": (
        ("caddy run --config /etc/caddy/Caddyfile --adapter caddyfile", 64, 0.6),
        ("nginx: master process /usr/sbin/nginx", 14, 0.0),
        ("nginx: worker process", 11, 0.0),
        ("nginx: worker process", 11, 0.0),
    ),
    "web": (
        ("next-server (v15.3.8)", 197, 0.6),
        ("node /app/.next/standalone/server.js", 142, 0.4),
        ("PM2 v6.0.8: God Daemon (/home/azureuser/.pm2)", 74, 0.0),
        ("node /app/node_modules/next/dist/server/lib/start-server.js", 88, 0.3),
    ),
    "api": (
        (
            "python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 2",
            31,
            0.5,
        ),
        (
            "python -c from multiprocessing.spawn import spawn_main; "
            "spawn_main(tracker_fd=16, pipe_handle=22)",
            379,
            0.4,
        ),
        (
            "python -c from multiprocessing.spawn import spawn_main; "
            "spawn_main(tracker_fd=16, pipe_handle=18)",
            372,
            0.3,
        ),
        (
            "python -c from multiprocessing.resource_tracker import main;main(15)",
            27,
            0.0,
        ),
        ("alembic upgrade head", 22, 0.0),
    ),
    "auth": (
        ("node /app/dist/index.js", 156, 0.5),
        ("node --inspect=0.0.0.0:9229 /app/dist/worker.js", 88, 0.2),
    ),
    "payments": (
        ("/app/payments serve --port 8080 --config /etc/payments/config.yaml", 96, 0.4),
        ("/app/payments worker --queue settlement", 64, 0.2),
    ),
    "worker": (
        ("python -m app.worker --concurrency 4", 184, 0.7),
        ("python -m celery -A app.tasks worker --loglevel=info", 142, 0.5),
        ("python -m celery -A app.tasks beat", 56, 0.1),
    ),
    "db": (
        ("postgres -D /var/lib/postgresql/data -c config_file=/etc/postgresql/postgresql.conf", 224, 0.8),
        ("postgres: checkpointer", 32, 0.1),
        ("postgres: background writer", 28, 0.0),
        ("postgres: walwriter", 22, 0.0),
        ("postgres: autovacuum launcher", 18, 0.0),
        ("postgres: logical replication launcher", 16, 0.0),
        ("postgres: stats collector", 14, 0.0),
    ),
    "cache": (
        ("redis-server 127.0.0.1:6379", 12, 0.2),
        ("redis-sentinel *:26379 [sentinel]", 9, 0.0),
    ),
}


def processes_for_host(host: Host) -> list[Process]:
    """Build a deterministic, role-shaped process list for a host.

    Combines a fixed system baseline (systemd, datadog-agent, kernel daemons)
    with role-specific workload processes. PIDs and resource usage are derived
    from the host id so reseeds are stable.
    """
    seed = abs(hash(host.id))
    role_procs = _ROLE_PROCESSES.get(host.role, ())
    templates = (*_BASELINE_PROCESSES, *role_procs)
    started_offset = (seed % 30000) + 1000
    out: list[Process] = []
    for idx, (cmd, baseline_rss, baseline_cpu) in enumerate(templates):
        # Deterministic per-process jitter so two hosts of the same role
        # don't show identical numbers.
        jitter = ((seed >> (idx % 16)) & 0xFF) / 255.0  # 0..1
        rss = max(1, int(baseline_rss * (0.85 + 0.3 * jitter)))
        cpu = round(baseline_cpu * (0.7 + 0.6 * jitter), 2)
        # systemd is always pid 1; everything else gets a stable pseudo-pid.
        pid = 1 if cmd.startswith("systemd --system") else (
            1000 + idx * 137 + (seed % 90000)
        )
        out.append(
            Process(
                host_id=host.id,
                pid=pid,
                command=cmd,
                parent_pid=None if pid == 1 else 1,
                started_seconds_ago=started_offset + idx * 300,
                cpu_percent=cpu,
                rss_mib=rss,
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
