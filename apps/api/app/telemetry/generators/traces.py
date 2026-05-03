"""Distributed-trace generator.

Each tick, every entry-point service emits a Poisson-distributed number of
traces. Each trace has a root span; we then walk `topology.dependencies`
recursively, attaching child spans with realistic latencies. Errors propagate
upstream — if a leaf span errors, its parent has higher chance of also erroring.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

from app.core.config import get_settings
from app.telemetry.rng import lognormal_ms, seeded_rng
from app.telemetry.topology import (
    DEPENDENCIES,
    HOSTS,
    Operation,
    OPERATIONS_BY_SERVICE,
    callees_of,
    entry_operations,
    hosts_for_service,
)


# Avg traces per entry-service per tick (5s). Scaled by daily-sine elsewhere.
_BASE_TRACES_PER_TICK: dict[str, float] = {
    "caddy": 6.0,
    "web": 4.0,
    "api": 3.0,
}


@dataclass(frozen=True)
class Span:
    ts_seconds: float
    trace_id: str
    span_id: str
    parent_span_id: str | None
    service: str
    operation: str
    resource: str
    duration_us: int
    status: int  # 0=ok, 1=error
    http_method: str | None
    http_status: int | None
    host: str | None
    env: str
    tags: dict[str, str]


def _new_id(rng) -> str:
    return f"{rng.getrandbits(64):016x}"


def _new_trace_id(rng) -> str:
    return f"{rng.getrandbits(64):016x}{rng.getrandbits(64):016x}"


def _emit_span_tree(
    *,
    rng,
    op: Operation,
    trace_id: str,
    parent_span_id: str | None,
    start_seconds: float,
    parent_errored: bool,
) -> tuple[list[Span], int]:
    """Recursively emit a span and its children. Returns (spans, total_duration_us).

    The parent's reported duration is base_self_us + max(child_durations) so the
    waterfall is internally consistent.
    """
    span_id = _new_id(rng)
    self_latency_ms = max(0.5, lognormal_ms(rng, op.base_latency_ms, op.latency_sigma))
    self_duration_us = int(self_latency_ms * 1000)

    # Choose host for this span (random across the service's hosts)
    hosts = hosts_for_service(op.service)
    host = rng.choice(hosts) if hosts else None

    # Decide on error
    error_prob = op.error_rate
    if parent_errored:
        error_prob = min(0.7, error_prob * 5)
    is_error = rng.random() < error_prob

    # Child spans: walk dependencies for this op's service
    children: list[Span] = []
    max_child_duration = 0
    deps = callees_of(op.service)
    # Each dep fires with probability proportional to weight (clamped 0..1)
    child_start = start_seconds + (self_duration_us / 1_000_000) * 0.1
    for dep in deps:
        if rng.random() > min(1.0, dep.weight):
            continue
        callee_ops = OPERATIONS_BY_SERVICE.get(dep.callee, [])
        if not callee_ops:
            continue
        callee_op = rng.choice(callee_ops)
        child_spans, child_duration = _emit_span_tree(
            rng=rng,
            op=callee_op,
            trace_id=trace_id,
            parent_span_id=span_id,
            start_seconds=child_start,
            parent_errored=is_error,
        )
        children.extend(child_spans)
        max_child_duration = max(max_child_duration, child_duration)
        # Sequential calls offset slightly
        child_start += (child_duration / 1_000_000) * 0.05

    total_duration_us = self_duration_us + max_child_duration

    resource = rng.choice(op.resource_pool)
    method = rng.choice(op.http_method_pool) if op.http_method_pool else None
    if is_error:
        http_status = rng.choice((500, 502, 503))
    else:
        http_status = rng.choice((200, 201, 204)) if op.http_method_pool else None

    tags: dict[str, str] = {}
    if host:
        tags["region"] = host.region
        tags["availability-zone"] = host.availability_zone
        tags["version"] = host.version

    span = Span(
        ts_seconds=start_seconds,
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        service=op.service,
        operation=op.name,
        resource=resource,
        duration_us=total_duration_us,
        status=1 if is_error else 0,
        http_method=method,
        http_status=http_status,
        host=host.id if host else None,
        env=host.env if host else "prod",
        tags=tags,
    )
    return [span] + children, total_duration_us


def iter_spans_for_tick(t_seconds: float) -> Iterator[Span]:
    """Yield all spans across all traces emitted this tick."""
    rate_factor = get_settings().trace_rate_factor
    for entry_op in entry_operations():
        rate = _BASE_TRACES_PER_TICK.get(entry_op.service, 2.0) * rate_factor
        rng = seeded_rng("trace_count", entry_op.service, int(t_seconds))
        n_traces = _poisson(rng, rate)
        for i in range(n_traces):
            trace_rng = seeded_rng("trace", entry_op.service, int(t_seconds), i)
            trace_id = _new_trace_id(trace_rng)
            start_offset = trace_rng.random() * 5.0  # within the 5s tick
            spans, _ = _emit_span_tree(
                rng=trace_rng,
                op=entry_op,
                trace_id=trace_id,
                parent_span_id=None,
                start_seconds=t_seconds + start_offset,
                parent_errored=False,
            )
            for s in spans:
                yield s


def _poisson(rng, lam: float) -> int:
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1
