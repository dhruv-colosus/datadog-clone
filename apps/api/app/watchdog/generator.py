"""Watchdog story generator: scans recent metrics for anomalous behavior
and emits Stories with English narratives.

Runs as a background asyncio task started by `app.main.lifespan`. The
generator is intentionally conservative — it dedupes on (service, metric)
within an active window so one anomalous metric doesn't produce a flood.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import statistics
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.telemetry.pool import get_pool
from app.telemetry.topology import SERVICES


logger = logging.getLogger(__name__)

GEN_INTERVAL_SECONDS = 90

_ANOMALY_METRICS = (
    ("api", "api.request_latency_ms", "API request latency"),
    ("payments", "payments.error_count", "Payments error count"),
    ("web", "web.request_count", "Web request volume"),
    ("postgres", "postgresql.percent_usage_connections", "Postgres connection pool"),
    ("redis", "redis.commands.processed", "Redis command throughput"),
    ("worker", "worker.queue_depth", "Worker queue depth"),
)


def _format_value(metric: str, value: float) -> str:
    if "latency" in metric:
        return f"{value:.0f} ms"
    if "percent" in metric or "rate" in metric:
        return f"{value:.1f}%"
    return f"{value:.2f}"


def _narrative(*, service: str, metric: str, value: float, baseline: float, sigmas: float) -> str:
    descriptor = "anomalously high" if value > baseline else "anomalously low"
    return (
        f"{metric} on {service} is {descriptor} — currently "
        f"{_format_value(metric, value)} vs. baseline "
        f"{_format_value(metric, baseline)} ({sigmas:.1f}σ deviation). "
        f"Watchdog identified this pattern from the last 30 minutes of telemetry."
    )


def _severity_for_sigma(sigmas: float) -> str:
    if sigmas >= 4:
        return "high"
    if sigmas >= 2.5:
        return "medium"
    return "low"


async def _has_recent_active_story(
    *, service: str, metric: str, since_minutes: int = 60
) -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT 1 FROM watchdog_stories
            WHERE service = $1 AND metric = $2 AND status = 'active'
              AND started_at >= NOW() - make_interval(mins => $3)
            LIMIT 1
            """,
            service, metric, since_minutes,
        )
    return row is not None


async def _scan_metric_for_anomalies(
    service: str, metric: str, label: str
) -> tuple[float, float, float, list[dict[str, Any]]] | None:
    """Return (current_value, baseline, sigmas, recent_points) if anomalous."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT EXTRACT(EPOCH FROM time_bucket('60 seconds', ts)) AS bucket,
                   AVG(value) AS v
            FROM metric_points
            WHERE name = $1 AND ts >= NOW() - INTERVAL '30 minutes'
            GROUP BY bucket
            ORDER BY bucket
            """,
            metric,
        )
    if len(rows) < 10:
        return None
    values = [float(r["v"]) for r in rows if r["v"] is not None]
    history = values[:-3]
    recent = values[-3:]
    if len(history) < 6:
        return None
    mean = statistics.fmean(history)
    stdev = statistics.pstdev(history)
    if stdev <= 0:
        return None
    current = recent[-1]
    sigmas = abs(current - mean) / stdev
    if sigmas < 2.0:
        return None
    points = [
        {
            "ts": int(float(r["bucket"]) * 1000),
            "value": float(r["v"]) if r["v"] is not None else None,
        }
        for r in rows
    ]
    return current, mean, sigmas, points


async def _create_story(
    *,
    service: str,
    metric: str,
    label: str,
    current: float,
    baseline: float,
    sigmas: float,
    points: list[dict[str, Any]],
) -> None:
    pool = await get_pool()
    severity = _severity_for_sigma(sigmas)
    title = (
        f"Anomalous {label.lower()} on {service}"
        if "latency" not in metric
        else f"Latency anomaly on {service}"
    )
    narrative = _narrative(
        service=service,
        metric=metric,
        value=current,
        baseline=baseline,
        sigmas=sigmas,
    )
    upper = baseline + 2 * (current - baseline) / max(sigmas, 0.5)
    lower = baseline - 2 * (current - baseline) / max(sigmas, 0.5)
    evidence = {
        "points": points,
        "baseline": baseline,
        "upper": max(upper, lower),
        "lower": min(upper, lower),
        "sigmas": sigmas,
        "currentValue": current,
        "metricLabel": label,
    }
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO watchdog_stories
                (id, kind, title, narrative, severity, status, service, metric, evidence)
            VALUES ($1, 'anomaly', $2, $3, $4, 'active', $5, $6, $7::jsonb)
            """,
            uuid.uuid4(),
            title,
            narrative,
            severity,
            service,
            metric,
            json.dumps(evidence),
        )
    logger.info("watchdog: new %s story for %s/%s", severity, service, metric)


async def generate_once() -> int:
    created = 0
    for service, metric, label in _ANOMALY_METRICS:
        try:
            if await _has_recent_active_story(service=service, metric=metric):
                continue
            scan = await _scan_metric_for_anomalies(service, metric, label)
            if scan is None:
                continue
            current, baseline, sigmas, points = scan
            await _create_story(
                service=service,
                metric=metric,
                label=label,
                current=current,
                baseline=baseline,
                sigmas=sigmas,
                points=points,
            )
            created += 1
        except Exception:  # noqa: BLE001
            logger.exception("watchdog: failed scanning %s/%s", service, metric)
    return created


async def auto_resolve_stale_stories() -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        res = await conn.execute(
            """
            UPDATE watchdog_stories
               SET status = 'resolved', ended_at = NOW(), updated_at = NOW()
             WHERE status = 'active'
               AND started_at < NOW() - INTERVAL '6 hours'
            """
        )
    count = int(res.split()[-1]) if res else 0
    return count


async def watchdog_loop() -> None:
    logger.info(
        "watchdog.generator: loop start (interval=%ss)", GEN_INTERVAL_SECONDS
    )
    while True:
        try:
            n = await generate_once()
            r = await auto_resolve_stale_stories()
            if n or r:
                logger.info(
                    "watchdog.generator: created=%d resolved=%d", n, r
                )
        except Exception:  # noqa: BLE001
            logger.exception("watchdog.generator: tick failed; will continue")
        await asyncio.sleep(GEN_INTERVAL_SECONDS)
