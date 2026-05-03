"""Main 5s tick loop: composes a tick of metrics + logs + spans + spike sweep,
bulk-COPYs into the hypertables, and reaps decayed spikes.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import time
from typing import Iterable

import asyncpg

from app.core.config import get_settings
from app.telemetry.generators.logs import iter_lines_for_tick
from app.telemetry.generators.metrics import iter_points_for_tick
from app.telemetry.generators.traces import iter_spans_for_tick
from app.telemetry.pool import get_pool
from app.telemetry.spike_injector import (
    get_registry,
    maybe_inject_auto_spikes,
)


logger = logging.getLogger(__name__)


METRIC_COLUMNS = (
    "ts", "name", "value", "host", "service", "env", "metric_type", "tags",
)
LOG_COLUMNS = (
    "ts", "service", "host", "env", "status", "message", "attributes",
    "trace_id", "span_id",
)
SPAN_COLUMNS = (
    "ts", "trace_id", "span_id", "parent_span_id", "service", "operation",
    "resource", "duration_us", "status", "http_method", "http_status",
    "host", "env", "tags",
)


def _seconds_to_dt(t_seconds: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(t_seconds, tz=dt.timezone.utc)


async def write_tick(
    pool: asyncpg.Pool,
    t_seconds: float,
    spike_multipliers: dict[tuple[str, str], float],
) -> tuple[int, int, int]:
    """Generate + COPY-insert one tick. Returns (n_metrics, n_logs, n_spans)."""

    metric_rows = [
        (
            _seconds_to_dt(p.ts_seconds),
            p.name,
            p.value,
            p.host,
            p.service,
            p.env,
            p.metric_type,
            json.dumps(p.tags),
        )
        for p in iter_points_for_tick(t_seconds, spike_multipliers=spike_multipliers)
    ]
    log_rows = [
        (
            _seconds_to_dt(line.ts_seconds),
            line.service,
            line.host,
            line.env,
            line.status,
            line.message,
            json.dumps(line.attributes),
            line.trace_id,
            line.span_id,
        )
        for line in iter_lines_for_tick(t_seconds)
    ]
    span_rows = [
        (
            _seconds_to_dt(s.ts_seconds),
            s.trace_id,
            s.span_id,
            s.parent_span_id,
            s.service,
            s.operation,
            s.resource,
            s.duration_us,
            s.status,
            s.http_method,
            s.http_status,
            s.host,
            s.env,
            json.dumps(s.tags),
        )
        for s in iter_spans_for_tick(t_seconds)
    ]

    async with pool.acquire() as conn:
        async with conn.transaction():
            if metric_rows:
                await conn.copy_records_to_table(
                    "metric_points", records=metric_rows, columns=METRIC_COLUMNS
                )
            if log_rows:
                await conn.copy_records_to_table(
                    "log_lines", records=log_rows, columns=LOG_COLUMNS
                )
            if span_rows:
                await conn.copy_records_to_table(
                    "spans", records=span_rows, columns=SPAN_COLUMNS
                )

    return len(metric_rows), len(log_rows), len(span_rows)


async def runner_loop() -> None:
    """Run forever; emits one tick every TICK_INTERVAL_SECONDS."""
    settings = get_settings()
    interval = settings.tick_interval_seconds
    pool = await get_pool()
    registry = get_registry()
    await registry.load_from_db(pool)

    logger.info("telemetry.runner: loop start (interval=%ss)", interval)
    tick_index = 0
    while True:
        started = time.perf_counter()
        now = dt.datetime.now(dt.timezone.utc)
        t_seconds = now.timestamp()
        try:
            await maybe_inject_auto_spikes(now)
            await registry.reap_done(pool, now)
            multipliers = await registry.multipliers(now)
            n_m, n_l, n_s = await write_tick(pool, t_seconds, multipliers)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            tick_index += 1
            if tick_index % 12 == 1:  # log every minute
                logger.info(
                    "telemetry.runner: tick=%d metrics=%d logs=%d spans=%d %dms",
                    tick_index, n_m, n_l, n_s, elapsed_ms,
                )
        except Exception:  # noqa: BLE001
            logger.exception("telemetry.runner: tick failed; will continue")
        # Sleep for the remainder of the interval
        slept = time.perf_counter() - started
        await asyncio.sleep(max(0.1, interval - slept))
