"""One-shot backfill: walks `now - days → now` at the tick interval and
bulk-inserts metrics + logs + spans so the UI has 7 days of history immediately
on first boot.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import time

import asyncpg

from app.core.config import get_settings
from app.telemetry.generators.rum import iter_events_for_tick as iter_rum_for_tick
from app.telemetry.pool import get_pool
from app.telemetry.runner import RUM_COLUMNS, write_tick

logger = logging.getLogger(__name__)


async def metric_points_is_empty(pool: asyncpg.Pool) -> bool:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM metric_points LIMIT 1")
        return row is None


async def rum_events_is_empty(pool: asyncpg.Pool) -> bool:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM rum_events LIMIT 1")
        return row is None


async def recent_spans_count(pool: asyncpg.Pool, lookback_seconds: int = 900) -> int:
    """How many spans in the last `lookback_seconds`. Used to decide whether
    the APM dashboards have enough live data to render meaningfully."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) AS c FROM spans "
            "WHERE ts >= NOW() - ($1::int * INTERVAL '1 second')",
            lookback_seconds,
        )
        return int(row["c"] or 0)


async def run_backfill(days: int | None = None) -> dict[str, int]:
    """Backfill `days` days of history. Returns row counts."""
    settings = get_settings()
    days = days or settings.backfill_days
    interval = settings.tick_interval_seconds

    pool = await get_pool()

    now = dt.datetime.now(dt.timezone.utc)
    start = now - dt.timedelta(days=days)
    total_steps = int((now - start).total_seconds() // interval)

    logger.info(
        "telemetry.backfill: start days=%d steps=%d interval=%ss",
        days, total_steps, interval,
    )
    started = time.perf_counter()
    progress_every = max(1, total_steps // 20)

    total_m = total_l = total_s = total_r = 0
    for i in range(total_steps):
        t_seconds = (start + dt.timedelta(seconds=i * interval)).timestamp()
        n_m, n_l, n_s, n_r = await write_tick(
            pool, t_seconds, spike_multipliers={},
            tick_duration_seconds=float(interval),
        )
        total_m += n_m
        total_l += n_l
        total_s += n_s
        total_r += n_r
        if i and i % progress_every == 0:
            pct = (i / total_steps) * 100
            logger.info(
                "telemetry.backfill: %5.1f%% (metrics=%d logs=%d spans=%d rum=%d)",
                pct, total_m, total_l, total_s, total_r,
            )

    elapsed = time.perf_counter() - started
    logger.info(
        "telemetry.backfill: done metrics=%d logs=%d spans=%d rum=%d in %.1fs",
        total_m, total_l, total_s, total_r, elapsed,
    )
    return {
        "metrics": total_m,
        "logs": total_l,
        "spans": total_s,
        "rum": total_r,
    }


async def run_recent_window_backfill(
    *,
    lookback_seconds: int = 3600,
    step_seconds: int = 30,
) -> dict[str, int]:
    """Quickly populate the last `lookback_seconds` of telemetry.

    Used on lifespan startup whenever the spans table is sparse (e.g. fresh
    DB, or runner has only fired a few ticks). Walks back from now at a
    tighter `step_seconds` cadence than the live runner so APM dashboards
    have meaningful data within seconds of boot, not minutes.
    """
    pool = await get_pool()
    now = dt.datetime.now(dt.timezone.utc)
    start = now - dt.timedelta(seconds=lookback_seconds)
    total_steps = max(1, lookback_seconds // step_seconds)
    started = time.perf_counter()
    total_m = total_l = total_s = total_r = 0
    for i in range(total_steps):
        t_seconds = (start + dt.timedelta(seconds=i * step_seconds)).timestamp()
        n_m, n_l, n_s, n_r = await write_tick(
            pool, t_seconds, spike_multipliers={},
            tick_duration_seconds=float(step_seconds),
        )
        total_m += n_m
        total_l += n_l
        total_s += n_s
        total_r += n_r
    elapsed = time.perf_counter() - started
    logger.info(
        "telemetry.backfill: recent-window done lookback=%ds step=%ds "
        "metrics=%d logs=%d spans=%d rum=%d in %.1fs",
        lookback_seconds, step_seconds, total_m, total_l, total_s, total_r, elapsed,
    )
    return {
        "metrics": total_m,
        "logs": total_l,
        "spans": total_s,
        "rum": total_r,
    }


async def run_backfill_if_empty() -> dict[str, int] | None:
    """Helper for lifespan: ensure dashboards have data on startup.

    Three cases handled:
    - Fresh DB (metric_points empty): full multi-day backfill if BACKFILL_ON_BOOT,
      otherwise a 1-hour recent-window backfill so APM/logs/metrics aren't blank.
    - Older deploy missing rum_events: RUM-only backfill.
    - APM table sparse (fewer than ~30 spans in last 15 min): top up the recent
      window so /apm/services and /apm/service-map render meaningful traffic.
    """
    settings = get_settings()
    pool = await get_pool()

    if await metric_points_is_empty(pool):
        if settings.backfill_on_boot:
            return await run_backfill()
        logger.info(
            "telemetry.backfill: BACKFILL_ON_BOOT=false but DB empty — "
            "running 1h recent-window backfill so dashboards aren't blank"
        )
        return await run_recent_window_backfill(lookback_seconds=3600, step_seconds=30)

    if await rum_events_is_empty(pool):
        logger.info("telemetry.backfill: metrics present but rum empty — RUM-only backfill")
        return await run_rum_only_backfill()

    span_count = await recent_spans_count(pool, lookback_seconds=900)
    if span_count < 30:
        logger.info(
            "telemetry.backfill: only %d spans in last 15m — running quick "
            "recent-window backfill to populate APM dashboards",
            span_count,
        )
        return await run_recent_window_backfill(lookback_seconds=3600, step_seconds=30)

    logger.info("telemetry.backfill: skipped (DB has recent data)")
    return None


async def run_rum_only_backfill(days: int | None = None) -> dict[str, int]:
    """Backfill *only* RUM events for the same window. Used when an existing
    deployment gets the RUM migration without re-seeding metrics.
    """
    settings = get_settings()
    days = days or settings.backfill_days
    interval = settings.tick_interval_seconds

    pool = await get_pool()
    now = dt.datetime.now(dt.timezone.utc)
    start = now - dt.timedelta(days=days)
    total_steps = int((now - start).total_seconds() // interval)

    logger.info(
        "telemetry.backfill: rum-only start days=%d steps=%d interval=%ss",
        days, total_steps, interval,
    )
    started = time.perf_counter()
    progress_every = max(1, total_steps // 20)

    total_r = 0
    for i in range(total_steps):
        t_seconds = (start + dt.timedelta(seconds=i * interval)).timestamp()
        rows = [
            (
                dt.datetime.fromtimestamp(e.ts_seconds, tz=dt.timezone.utc),
                e.application_id, e.session_id, e.view_id, e.event_type,
                e.service, e.env, e.version,
                e.user_id, e.user_name, e.user_email,
                e.geo_country, e.geo_city,
                e.browser_name, e.browser_version, e.os_name, e.device_type,
                e.view_url, e.view_path, e.view_referrer,
                e.loading_time_ms, e.lcp_ms, e.fcp_ms, e.inp_ms, e.cls,
                e.time_spent_ms,
                e.error_message, e.error_source, e.error_stack,
                e.action_type, e.action_name,
                e.resource_url, e.resource_method, e.resource_status,
                e.resource_duration_ms, e.long_task_duration_ms,
                e.session_view_count, e.session_action_count,
                e.session_error_count, e.session_frustration_count,
                e.session_time_spent_ms, e.session_is_active,
                json.dumps(e.attributes),
            )
            for e in iter_rum_for_tick(t_seconds)
        ]
        if rows:
            async with pool.acquire() as conn:
                await conn.copy_records_to_table(
                    "rum_events", records=rows, columns=RUM_COLUMNS
                )
            total_r += len(rows)
        if i and i % progress_every == 0:
            pct = (i / total_steps) * 100
            logger.info(
                "telemetry.backfill: rum-only %5.1f%% (rum=%d)", pct, total_r,
            )

    elapsed = time.perf_counter() - started
    logger.info(
        "telemetry.backfill: rum-only done rum=%d in %.1fs", total_r, elapsed,
    )
    return {"rum": total_r}
