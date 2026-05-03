"""Spike injector — Bernoulli per-(metric, host) per tick, decays over time.

Active spikes live in-memory for fast lookup during metric generation, and are
also persisted to the `spike_log` table so they:
  - survive restarts
  - drive the Watchdog feed (Phase 8g)
  - are queryable / cleanable from the admin endpoint
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import math
import random
from dataclasses import dataclass
from typing import Iterable

import asyncpg

from app.telemetry.pool import get_pool
from app.telemetry.rng import seeded_rng
from app.telemetry.topology import HOSTS, METRIC_CATALOG, hosts_for_metric


SPIKE_PROBABILITY_PER_SERIES_PER_TICK = 0.0001  # ~one in 10k per tick → demo-friendly
SPIKE_MIN_MAGNITUDE = 3.0
SPIKE_MAX_MAGNITUDE = 10.0
SPIKE_MIN_DECAY_S = 30
SPIKE_MAX_DECAY_S = 120


@dataclass
class ActiveSpike:
    metric_name: str
    host_id: str
    started_at: dt.datetime
    magnitude: float  # peak multiplier (1.0 = no spike)
    decay_seconds: float
    source: str  # 'auto' | 'manual'

    def multiplier_at(self, t: dt.datetime) -> float:
        elapsed = (t - self.started_at).total_seconds()
        if elapsed < 0:
            return 1.0
        # Exponential decay back toward 1.0
        decay_ratio = math.exp(-elapsed / max(self.decay_seconds, 1.0))
        return 1.0 + (self.magnitude - 1.0) * decay_ratio

    def is_done(self, t: dt.datetime) -> bool:
        # Considered done when multiplier within 5% of baseline
        return self.multiplier_at(t) < 1.05


class SpikeRegistry:
    """In-memory store of currently-active spikes."""

    def __init__(self) -> None:
        self._spikes: list[ActiveSpike] = []
        self._lock = asyncio.Lock()

    async def load_from_db(self, pool: asyncpg.Pool) -> None:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT metric_name, host, started_at, magnitude, decay_seconds, source
                FROM spike_log
                WHERE ended_at IS NULL
                """
            )
        async with self._lock:
            self._spikes = [
                ActiveSpike(
                    metric_name=r["metric_name"],
                    host_id=r["host"] or "",
                    started_at=r["started_at"],
                    magnitude=float(r["magnitude"]),
                    decay_seconds=float(r["decay_seconds"]),
                    source=r["source"],
                )
                for r in rows
            ]

    async def add(self, pool: asyncpg.Pool, spike: ActiveSpike) -> None:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO spike_log (
                    metric_name, host, started_at, magnitude, decay_seconds, source
                ) VALUES ($1, $2, $3, $4, $5, $6)
                """,
                spike.metric_name,
                spike.host_id or None,
                spike.started_at,
                spike.magnitude,
                spike.decay_seconds,
                spike.source,
            )
        async with self._lock:
            self._spikes.append(spike)

    async def reap_done(self, pool: asyncpg.Pool, now: dt.datetime) -> None:
        async with self._lock:
            still_active: list[ActiveSpike] = []
            done: list[ActiveSpike] = []
            for s in self._spikes:
                (done if s.is_done(now) else still_active).append(s)
            self._spikes = still_active
        if done:
            async with pool.acquire() as conn:
                for s in done:
                    await conn.execute(
                        """
                        UPDATE spike_log
                        SET ended_at = $1
                        WHERE metric_name = $2 AND host = $3
                          AND started_at = $4 AND ended_at IS NULL
                        """,
                        now,
                        s.metric_name,
                        s.host_id or None,
                        s.started_at,
                    )

    async def multipliers(
        self, t: dt.datetime
    ) -> dict[tuple[str, str], float]:
        async with self._lock:
            out: dict[tuple[str, str], float] = {}
            for s in self._spikes:
                key = (s.metric_name, s.host_id)
                mult = s.multiplier_at(t)
                if mult > out.get(key, 1.0):
                    out[key] = mult
            return out


# Singleton — owned by the lifespan
_registry: SpikeRegistry | None = None


def get_registry() -> SpikeRegistry:
    global _registry
    if _registry is None:
        _registry = SpikeRegistry()
    return _registry


async def maybe_inject_auto_spikes(now: dt.datetime) -> None:
    """Per-tick Bernoulli sweep: occasionally start a new auto spike."""
    pool = await get_pool()
    registry = get_registry()
    rng = seeded_rng("auto_spike", int(now.timestamp()))
    for metric in METRIC_CATALOG:
        for host in hosts_for_metric(metric):
            if rng.random() > SPIKE_PROBABILITY_PER_SERIES_PER_TICK:
                continue
            magnitude = rng.uniform(SPIKE_MIN_MAGNITUDE, SPIKE_MAX_MAGNITUDE)
            decay = rng.uniform(SPIKE_MIN_DECAY_S, SPIKE_MAX_DECAY_S)
            await registry.add(
                pool,
                ActiveSpike(
                    metric_name=metric.name,
                    host_id=host.id,
                    started_at=now,
                    magnitude=magnitude,
                    decay_seconds=decay,
                    source="auto",
                ),
            )


async def inject_manual_spike(
    *,
    metric: str,
    service: str | None = None,
    host: str | None = None,
    magnitude: float = 5.0,
    decay_seconds: float = 90.0,
) -> int:
    """Triggered by /admin/inject-spike. Returns count of (metric, host) hits."""
    from app.telemetry.topology import METRICS_BY_NAME

    pool = await get_pool()
    registry = get_registry()
    metric_def = METRICS_BY_NAME.get(metric)
    if metric_def is None:
        raise ValueError(f"Unknown metric: {metric}")

    candidate_hosts = hosts_for_metric(metric_def)
    if service:
        candidate_hosts = [h for h in candidate_hosts if h.service == service]
    if host:
        candidate_hosts = [h for h in candidate_hosts if h.id == host]
    if not candidate_hosts:
        return 0

    now = dt.datetime.now(dt.timezone.utc)
    for h in candidate_hosts:
        await registry.add(
            pool,
            ActiveSpike(
                metric_name=metric,
                host_id=h.id,
                started_at=now,
                magnitude=magnitude,
                decay_seconds=decay_seconds,
                source="manual",
            ),
        )
    return len(candidate_hosts)
