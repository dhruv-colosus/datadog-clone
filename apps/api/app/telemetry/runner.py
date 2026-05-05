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
from app.telemetry.generators.rum import iter_events_for_tick as iter_rum_for_tick
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
RUM_COLUMNS = (
    "ts", "application_id", "session_id", "view_id", "event_type", "service",
    "env", "version", "user_id", "user_name", "user_email", "geo_country",
    "geo_city", "browser_name", "browser_version", "os_name", "device_type",
    "view_url", "view_path", "view_referrer", "loading_time_ms", "lcp_ms",
    "fcp_ms", "inp_ms", "cls", "time_spent_ms", "error_message",
    "error_source", "error_stack", "action_type", "action_name", "resource_url",
    "resource_method", "resource_status", "resource_duration_ms",
    "long_task_duration_ms", "session_view_count", "session_action_count",
    "session_error_count", "session_frustration_count", "session_time_spent_ms",
    "session_is_active", "attributes",
)


def _seconds_to_dt(t_seconds: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(t_seconds, tz=dt.timezone.utc)


async def write_tick(
    pool: asyncpg.Pool,
    t_seconds: float,
    spike_multipliers: dict[tuple[str, str], float],
    tick_duration_seconds: float | None = None,
) -> tuple[int, int, int, int]:
    """Generate + COPY-insert one tick.

    `tick_duration_seconds` scales generators that need to know how much wall-
    clock time the tick covers (currently traces). Defaults to the configured
    `TICK_INTERVAL_SECONDS` so the live runner produces proportional traffic.

    Returns (n_metrics, n_logs, n_spans, n_rum_events).
    """
    if tick_duration_seconds is None:
        tick_duration_seconds = float(get_settings().tick_interval_seconds)

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
    from app.log_config.runtime import apply_to_log
    log_rows: list[tuple] = []
    pending_findings: list[tuple[str, str, list[dict]]] = []
    for line in iter_lines_for_tick(t_seconds):
        raw_log = {
            "ts": _seconds_to_dt(line.ts_seconds),
            "service": line.service,
            "host": line.host,
            "env": line.env,
            "status": line.status,
            "message": line.message,
            "attributes": dict(line.attributes),
            "trace_id": line.trace_id,
            "span_id": line.span_id,
        }
        transformed, findings = apply_to_log(raw_log)
        log_rows.append((
            transformed.get("ts", _seconds_to_dt(line.ts_seconds)),
            transformed.get("service", line.service),
            transformed.get("host", line.host),
            transformed.get("env", line.env),
            transformed.get("status", line.status),
            transformed.get("message", line.message),
            json.dumps(transformed.get("attributes", {})),
            transformed.get("trace_id", line.trace_id),
            transformed.get("span_id", line.span_id),
        ))
        if findings:
            pending_findings.append((
                transformed.get("service", line.service),
                transformed.get("trace_id") or "",
                findings,
            ))
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
        for s in iter_spans_for_tick(t_seconds, tick_duration_seconds)
    ]
    rum_rows = [
        (
            _seconds_to_dt(e.ts_seconds),
            e.application_id,
            e.session_id,
            e.view_id,
            e.event_type,
            e.service,
            e.env,
            e.version,
            e.user_id,
            e.user_name,
            e.user_email,
            e.geo_country,
            e.geo_city,
            e.browser_name,
            e.browser_version,
            e.os_name,
            e.device_type,
            e.view_url,
            e.view_path,
            e.view_referrer,
            e.loading_time_ms,
            e.lcp_ms,
            e.fcp_ms,
            e.inp_ms,
            e.cls,
            e.time_spent_ms,
            e.error_message,
            e.error_source,
            e.error_stack,
            e.action_type,
            e.action_name,
            e.resource_url,
            e.resource_method,
            e.resource_status,
            e.resource_duration_ms,
            e.long_task_duration_ms,
            e.session_view_count,
            e.session_action_count,
            e.session_error_count,
            e.session_frustration_count,
            e.session_time_spent_ms,
            e.session_is_active,
            json.dumps(e.attributes),
        )
        for e in iter_rum_for_tick(t_seconds)
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
            if rum_rows:
                await conn.copy_records_to_table(
                    "rum_events", records=rum_rows, columns=RUM_COLUMNS
                )
            for service, log_id, findings in pending_findings:
                for f in findings:
                    await conn.execute(
                        "INSERT INTO scrubber_findings "
                        "(id, rule_id, service, log_id, excerpt_redacted, "
                        "pattern_matched) VALUES "
                        "(gen_random_uuid(), $1, $2, $3, $4, $5)",
                        f["rule_id"], service, log_id or None,
                        f["excerpt_redacted"], f["pattern_matched"],
                    )

    return len(metric_rows), len(log_rows), len(span_rows), len(rum_rows)


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
            n_m, n_l, n_s, n_r = await write_tick(pool, t_seconds, multipliers)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            tick_index += 1
            if tick_index % 12 == 1:  # log every minute
                logger.info(
                    "telemetry.runner: tick=%d metrics=%d logs=%d spans=%d rum=%d %dms",
                    tick_index, n_m, n_l, n_s, n_r, elapsed_ms,
                )
        except Exception:  # noqa: BLE001
            logger.exception("telemetry.runner: tick failed; will continue")
        # Sleep for the remainder of the interval
        slept = time.perf_counter() - started
        await asyncio.sleep(max(0.1, interval - slept))
