"""One-shot backfill: walks `now - days → now` at the tick interval and
bulk-inserts metrics + logs + spans so the UI has 7 days of history immediately
on first boot.
"""

from __future__ import annotations

import datetime as dt
import logging
import time

import asyncpg

from app.core.config import get_settings
from app.telemetry.pool import get_pool
from app.telemetry.runner import write_tick

logger = logging.getLogger(__name__)


async def metric_points_is_empty(pool: asyncpg.Pool) -> bool:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM metric_points LIMIT 1")
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

    total_m = total_l = total_s = 0
    for i in range(total_steps):
        t_seconds = (start + dt.timedelta(seconds=i * interval)).timestamp()
        n_m, n_l, n_s = await write_tick(pool, t_seconds, spike_multipliers={})
        total_m += n_m
        total_l += n_l
        total_s += n_s
        if i and i % progress_every == 0:
            pct = (i / total_steps) * 100
            logger.info(
                "telemetry.backfill: %5.1f%% (metrics=%d logs=%d spans=%d)",
                pct, total_m, total_l, total_s,
            )

    elapsed = time.perf_counter() - started
    logger.info(
        "telemetry.backfill: done metrics=%d logs=%d spans=%d in %.1fs",
        total_m, total_l, total_s, elapsed,
    )
    return {"metrics": total_m, "logs": total_l, "spans": total_s}


async def run_backfill_if_empty() -> dict[str, int] | None:
    """Helper for lifespan: run backfill only when metric_points has no rows."""
    settings = get_settings()
    if not settings.backfill_on_boot:
        return None
    pool = await get_pool()
    if not await metric_points_is_empty(pool):
        logger.info("telemetry.backfill: skipped (metric_points has data)")
        return None
    return await run_backfill()
