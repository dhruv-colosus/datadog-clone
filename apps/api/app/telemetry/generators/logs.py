"""Log line generator.

Each tick, for each service, we emit a Poisson-distributed number of log lines
drawn from the per-service templates. Reserved attributes (`@http.*`,
`@error.*`, `@duration`) are filled in to match Datadog's log conventions.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

from app.core.config import get_settings
from app.telemetry.rng import daily_sine, lognormal_ms, seeded_rng
from app.telemetry.topology import (
    HOSTS,
    LOG_TEMPLATES,
    LogTemplate,
    SERVICE_NAMES,
    hosts_for_service,
    templates_for_service,
)


LOG_LEVEL_CODES: dict[str, int] = {
    "info": 0,
    "warn": 1,
    "error": 2,
    "debug": 3,
}

# Avg log volume per service per tick (5s). Scaled by daily-sine to vary day/night.
_BASE_RATE_PER_TICK: dict[str, float] = {
    "caddy": 18.0,
    "web": 14.0,
    "api": 22.0,
    "auth": 8.0,
    "payments": 6.0,
    "worker": 10.0,
    "postgres": 5.0,
    "redis": 4.0,
}


@dataclass(frozen=True)
class LogLine:
    ts_seconds: float
    service: str
    host: str
    env: str
    status: int  # log level code
    message: str
    attributes: dict[str, object]
    trace_id: str | None
    span_id: str | None


def _pick_template(rng, templates: list[LogTemplate]) -> LogTemplate:
    weights = [t.weight for t in templates]
    total = sum(weights)
    pick = rng.uniform(0, total)
    acc = 0.0
    for t, w in zip(templates, weights):
        acc += w
        if pick <= acc:
            return t
    return templates[-1]


_PATHS_BY_SERVICE: dict[str, tuple[str, ...]] = {
    "api": ("/users/123", "/users/me", "/orders", "/orders/482", "/healthz",
            "/metrics/series", "/login", "/logout"),
    "web": ("/", "/dashboard", "/pricing", "/settings", "/account/billing"),
    "caddy": ("/", "/api/users", "/api/orders", "/static/app.js", "/static/style.css"),
}
_TABLES = ("users", "orders", "subscriptions", "sessions", "events", "items")
_ERR_MSGS = (
    "connection reset by peer",
    "deadlock detected",
    "context deadline exceeded",
    "EHOSTUNREACH",
    "permission denied",
)
_REASONS = ("timeout", "rate_limited", "invalid_input", "downstream_5xx", "throttled")
_USER_AGENTS = (
    "Mozilla/5.0 (Macintosh) Chrome/123.0",
    "Mozilla/5.0 (Windows NT 10.0) Firefox/126.0",
    "curl/8.4.0",
    "okhttp/4.12.0",
)
_AUTH_METHODS = ("password", "google", "github", "magic_link")


def _fill_template(
    template: LogTemplate,
    rng,
    host_id: str,
    t_seconds: float,
) -> tuple[str, dict[str, object]]:
    """Render the template + return Datadog-style reserved attributes."""
    method = rng.choice(("GET", "POST", "PATCH", "DELETE"))
    path_pool = _PATHS_BY_SERVICE.get(template.service, ("/",))
    path = rng.choice(path_pool)
    status_pool = (
        (200, 200, 200, 200, 204, 301)
        if template.level == "info"
        else (
            (404, 408, 429)
            if template.level == "warn"
            else (500, 502, 503, 504)
        )
    )
    status_code = rng.choice(status_pool)
    latency_ms = max(1.0, lognormal_ms(rng, mean_ms=80, sigma=0.7))
    if template.level == "warn":
        latency_ms = max(latency_ms, 350.0)
    if template.level == "error":
        latency_ms = max(latency_ms, 500.0)

    fields: dict[str, object] = {
        "method": method,
        "path": path,
        "status": status_code,
        "latency_ms": int(latency_ms),
        "req_id": f"{rng.getrandbits(48):012x}",
        "session_id": f"sess_{rng.getrandbits(32):08x}",
        "user_id": f"usr_{rng.getrandbits(32):08x}",
        "client_ip": f"203.0.{rng.randint(0,255)}.{rng.randint(0,255)}",
        "ua": rng.choice(_USER_AGENTS),
        "auth_method": rng.choice(_AUTH_METHODS),
        "kid": f"k{rng.randint(1, 4)}",
        "table": rng.choice(_TABLES),
        "id_param": rng.randint(1, 9999),
        "col": rng.randint(1, 200),
        "cache_key": f"cache:{rng.choice(_TABLES)}:{rng.randint(1, 9999)}",
        "ttl": rng.randint(1, 600),
        "err": rng.choice(_ERR_MSGS),
        "upstream": rng.choice(("api", "auth", "payments", "postgres", "redis")),
        "upstream_status": rng.choice((500, 502, 503, 504)),
        "amount": rng.randint(199, 99999),
        "currency": rng.choice(("USD", "EUR", "GBP")),
        "txn": f"txn_{rng.getrandbits(48):012x}",
        "attempt": rng.randint(1, 5),
        "reason": rng.choice(_REASONS),
        "job_kind": rng.choice(("payments.settle", "emails.send", "exports.csv")),
        "job_id": f"job_{rng.getrandbits(40):010x}",
        "op": rng.choice(("GET", "SET", "DEL", "EXPIRE")),
        "key": f"k:{rng.randint(1, 9999)}",
        "used_mb": rng.randint(120, 480),
        "max_mb": 512,
        "component": rng.choice(("Hero", "Pricing", "Footer", "Nav")),
    }
    try:
        message = template.template.format(**fields)
    except KeyError:
        message = template.template

    attrs: dict[str, object] = {
        "@duration": int(latency_ms),
        "@http.method": method,
        "@http.status_code": status_code,
        "@http.url": f"https://example.com{path}",
        "@network.client.ip": fields["client_ip"],
    }
    if template.level == "error":
        attrs["@error.kind"] = rng.choice(("DBError", "TimeoutError", "AssertionError"))
        attrs["@error.message"] = fields["err"]
        attrs["@error.stack"] = "  at handler (app.py:42)\n  at run (server.py:101)"
    return message, attrs


# Width of the trace-pool window. A pool is a small set of trace IDs that all
# log lines in the window draw from. Larger windows = more lines per trace,
# but coarser timestamps. 30s gives realistic-feeling multi-line transactions.
_TRACE_POOL_WINDOW_S = 30
_TRACE_POOL_SIZE = 12


def _trace_pool_for(t_seconds: float) -> list[str]:
    """Return the active trace IDs for the time window containing t_seconds.

    Lines that get a trace_id pick from this pool, so each trace ends up
    spanning multiple log lines (and often multiple services) within a
    ~30s request window — like a real transaction in production.

    Deterministic per window so re-running the same tick produces identical
    output.
    """
    window = int(t_seconds // _TRACE_POOL_WINDOW_S)
    rng = seeded_rng("trace_pool", window)
    return [
        f"{rng.getrandbits(64):016x}{rng.getrandbits(64):016x}"
        for _ in range(_TRACE_POOL_SIZE)
    ]


def iter_lines_for_tick(t_seconds: float) -> Iterator[LogLine]:
    """Yield log lines for every service for the given tick."""
    sine = daily_sine(t_seconds)  # in [-1, 1]
    rate_scale = 0.7 + 0.6 * (sine + 1) / 2  # 0.7..1.3
    rate_factor = get_settings().log_rate_factor
    trace_pool = _trace_pool_for(t_seconds)
    for service in SERVICE_NAMES:
        base_rate = _BASE_RATE_PER_TICK.get(service, 5.0) * rate_scale * rate_factor
        # Poisson sampling
        rng = seeded_rng("log_count", service, int(t_seconds))
        count = _poisson(rng, base_rate)
        templates = templates_for_service(service)
        if not templates:
            continue
        hosts = hosts_for_service(service) or list(HOSTS)
        for i in range(count):
            entry_rng = seeded_rng("log_entry", service, int(t_seconds), i)
            template = _pick_template(entry_rng, templates)
            host = entry_rng.choice(hosts)
            message, attrs = _fill_template(template, entry_rng, host.id, t_seconds)
            # ~60% of error logs and ~25% of info/warn logs carry a trace id.
            # Picking from a small per-window pool means a single trace gets
            # several log lines spanning the request, instead of one line per
            # trace (which made the transactions view show "1 logs" forever).
            include_trace = (
                (template.level == "error" and entry_rng.random() < 0.7)
                or (template.level != "error" and entry_rng.random() < 0.25)
            )
            trace_id = entry_rng.choice(trace_pool) if include_trace else None
            span_id = f"{entry_rng.getrandbits(64):016x}" if include_trace else None
            if trace_id:
                attrs["@trace_id"] = trace_id
            yield LogLine(
                ts_seconds=t_seconds + entry_rng.random() * 5.0,  # spread within tick
                service=service,
                host=host.id,
                env=host.env,
                status=LOG_LEVEL_CODES[template.level],
                message=message,
                attributes=attrs,
                trace_id=trace_id,
                span_id=span_id,
            )


def _poisson(rng, lam: float) -> int:
    """Knuth's Poisson sampling. Adequate for lam < ~30."""
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1
