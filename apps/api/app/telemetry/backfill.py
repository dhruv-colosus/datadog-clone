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
        n_m, n_l, n_s, n_r = await write_tick(pool, t_seconds, spike_multipliers={})
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


async def run_backfill_if_empty() -> dict[str, int] | None:
    """Helper for lifespan: run backfill only when metric_points has no rows.

    If metrics/logs/spans were already populated by an earlier boot but RUM
    is empty (post-migration upgrade), top up RUM only.
    """
    settings = get_settings()
    if not settings.backfill_on_boot:
        return None
    pool = await get_pool()
    if await metric_points_is_empty(pool):
        return await run_backfill()
    if await rum_events_is_empty(pool):
        logger.info("telemetry.backfill: metrics present but rum empty — RUM-only backfill")
        return await run_rum_only_backfill()
    logger.info("telemetry.backfill: skipped (metric_points + rum_events have data)")
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
