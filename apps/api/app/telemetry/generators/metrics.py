"""Metric point generator.

For each `(metric, host)` pair, `iter_points_for_tick` yields a single
`MetricPoint` shaped to match the `metric_points` hypertable columns.

Composition: baseline + daily-sine + drift (random walk) + noise + active spikes.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from typing import Iterable, Iterator

from app.core.config import get_settings
from app.telemetry.rng import daily_sine, seeded_rng
from app.telemetry.topology import (
    HOSTS,
    METRIC_CATALOG,
    Host,
    MetricDef,
    hosts_for_metric,
)


def _series_should_emit(metric_name: str, host_id: str, tick_index: int, sample_rate: float) -> bool:
    """Deterministic rotation so each series gets emitted every `1/sample_rate` ticks.

    With sample_rate=0.05, each series fires roughly every 20 ticks (every 20 minutes
    at a 60s tick). The rotation is keyed off (metric, host) so adjacent ticks emit
    different series — keeps the chart populated even at low sample rates.
    """
    if sample_rate >= 1.0:
        return True
    if sample_rate <= 0:
        return False
    bucket_count = max(1, int(round(1.0 / sample_rate)))
    raw = f"{metric_name}::{host_id}".encode()
    bucket = int.from_bytes(hashlib.blake2b(raw, digest_size=4).digest(), "big") % bucket_count
    return (tick_index % bucket_count) == bucket


METRIC_TYPE_CODES: dict[str, int] = {
    "gauge": 0,
    "count": 1,
    "rate": 2,
    "distribution": 3,
}


@dataclass(frozen=True)
class MetricPoint:
    ts_seconds: float
    name: str
    value: float
    host: str | None
    service: str | None
    env: str
    metric_type: int
    tags: dict[str, str]


def _drift_for(metric_name: str, host_id: str, t_bucket: int) -> float:
    """Deterministic random walk per (metric, host).

    Buckets in 5-minute windows so the drift is stable across nearby ticks but
    still wobbles on longer time scales.
    """
    rng = seeded_rng("drift", metric_name, host_id, t_bucket)
    return rng.gauss(0.0, 1.0)


def _value_for(
    metric: MetricDef,
    host: Host,
    t_seconds: float,
    spike_multiplier: float,
) -> float:
    sine = daily_sine(t_seconds) * metric.daily_amplitude
    t_bucket = int(t_seconds // 300)
    # Smoothed random walk: sample two adjacent buckets and average so the
    # transition from bucket to bucket isn't a jagged step.
    drift_a = _drift_for(metric.name, host.id, t_bucket)
    drift_b = _drift_for(metric.name, host.id, t_bucket + 1)
    drift = (drift_a + drift_b) / 2 * metric.daily_amplitude * 0.4

    noise_rng = seeded_rng("noise", metric.name, host.id, int(t_seconds))
    noise = noise_rng.gauss(0.0, 1.0) * metric.noise

    raw = metric.baseline + sine + drift + noise
    raw *= spike_multiplier

    # Clamp gauges-with-percent to [0, 100], otherwise just non-negative.
    if metric.unit == "%":
        return max(0.0, min(100.0, raw))
    return max(0.0, raw)


def _tags_for(host: Host, metric: MetricDef) -> dict[str, str]:
    """Extra tags beyond the promoted columns (host, service, env)."""
    tags: dict[str, str] = {
        "region": host.region,
        "availability-zone": host.availability_zone,
        "version": host.version,
        "team": host.team,
    }
    if host.kube_cluster_name:
        tags["kube_cluster_name"] = host.kube_cluster_name
    if host.kube_namespace:
        tags["kube_namespace"] = host.kube_namespace
    return tags


def iter_points_for_tick(
    t_seconds: float,
    *,
    spike_multipliers: dict[tuple[str, str], float] | None = None,
    sample_rate: float | None = None,
) -> Iterator[MetricPoint]:
    """Yield MetricPoints for series whose rotation slot matches this tick.

    `spike_multipliers` maps `(metric_name, host_id)` to a current spike factor
    (>=1.0). `sample_rate` defaults to settings.metric_sample_rate. Series with
    an active spike are always emitted regardless of rotation (so spikes are
    visible immediately on charts).
    """
    spikes = spike_multipliers or {}
    if sample_rate is None:
        sample_rate = get_settings().metric_sample_rate
    settings = get_settings()
    tick_index = int(t_seconds // max(1, settings.tick_interval_seconds))
    for metric in METRIC_CATALOG:
        for host in hosts_for_metric(metric):
            key = (metric.name, host.id)
            mult = spikes.get(key, 1.0)
            if mult <= 1.0 and not _series_should_emit(
                metric.name, host.id, tick_index, sample_rate
            ):
                continue
            value = _value_for(metric, host, t_seconds, mult)
            yield MetricPoint(
                ts_seconds=t_seconds,
                name=metric.name,
                value=value,
                host=host.id,
                service=host.service,
                env=host.env,
                metric_type=METRIC_TYPE_CODES[metric.type],
                tags=_tags_for(host, metric),
            )


def cardinality_estimate() -> int:
    """How many series we generate per tick (one row each)."""
    return sum(len(hosts_for_metric(m)) for m in METRIC_CATALOG)
