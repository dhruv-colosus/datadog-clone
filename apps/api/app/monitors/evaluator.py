"""Monitor evaluator: reads each monitor's query + thresholds, queries the
last `windowSeconds` of `metric_points`, and updates the `status` column
(`OK | Warn | Alert | No Data`).

Runs as a background asyncio task started by `app.main.lifespan`. The loop
ticks every `MONITOR_EVAL_INTERVAL_SECONDS` (default 30s) so the UI sees
state transitions within roughly that period.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import statistics
from typing import Any

from app.telemetry.pool import get_pool


logger = logging.getLogger(__name__)

EVAL_INTERVAL_SECONDS = 30

_AGG_SQL = {
    "avg": "AVG(value)",
    "sum": "SUM(value)",
    "min": "MIN(value)",
    "max": "MAX(value)",
}

_OPS = {
    ">": lambda v, t: v > t,
    ">=": lambda v, t: v >= t,
    "<": lambda v, t: v < t,
    "<=": lambda v, t: v <= t,
}


async def fetch_series(
    *,
    metric: str,
    window_seconds: int,
    step_seconds: int = 60,
) -> list[tuple[float, float]]:
    """Return [(epoch_seconds, value)] bucketed at step_seconds for the metric."""
    pool = await get_pool()
    sql = (
        "SELECT EXTRACT(EPOCH FROM time_bucket(make_interval(secs => $3), ts)) AS bucket, "
        "AVG(value) AS v FROM metric_points "
        "WHERE name = $1 AND ts >= NOW() - make_interval(secs => $2) "
        "GROUP BY bucket ORDER BY bucket"
    )
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, metric, window_seconds, step_seconds)
    return [(float(r["bucket"]), float(r["v"])) for r in rows if r["v"] is not None]


def evaluate_anomaly(
    series: list[tuple[float, float]],
    *,
    deviations: float = 2.0,
    direction: str = "both",
) -> tuple[str, dict[str, Any]]:
    """Rolling z-score anomaly detection (Basic algorithm).

    Returns (status, evidence) where evidence has {value, mean, stdev, upper, lower}.
    """
    if len(series) < 8:
        return "No Data", {}
    values = [v for _, v in series]
    history = values[:-1]
    current = values[-1]
    mean = statistics.fmean(history)
    stdev = statistics.pstdev(history) if len(history) > 1 else 0.0
    spread = stdev * deviations
    upper = mean + spread
    lower = mean - spread
    above = current > upper
    below = current < lower
    triggered = (
        (direction == "both" and (above or below))
        or (direction == "above" and above)
        or (direction == "below" and below)
    )
    evidence = {
        "value": current,
        "mean": mean,
        "stdev": stdev,
        "upper": upper,
        "lower": lower,
    }
    return ("Alert" if triggered else "OK", evidence)


def evaluate_forecast(
    series: list[tuple[float, float]],
    *,
    forecast_window_seconds: int,
    threshold: float,
    operator: str = ">",
) -> tuple[str, dict[str, Any]]:
    """Linear-regression forecast: project the trend `forecast_window_seconds` into
    the future and check if the projected value crosses `threshold`."""
    if len(series) < 4:
        return "No Data", {}
    xs = [t for t, _ in series]
    ys = [v for _, v in series]
    n = len(series)
    sx = sum(xs)
    sy = sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(xs[i] * ys[i] for i in range(n))
    denom = (n * sxx - sx * sx) or 1.0
    slope = (n * sxy - sx * sy) / denom
    intercept = (sy - slope * sx) / n
    last_t = xs[-1]
    future_t = last_t + forecast_window_seconds
    projected = slope * future_t + intercept
    op = _OPS.get(operator, _OPS[">"])
    triggered = op(projected, threshold)
    evidence = {
        "currentValue": ys[-1],
        "projectedValue": projected,
        "slope": slope,
        "threshold": threshold,
        "forecastWindowSeconds": forecast_window_seconds,
    }
    return ("Warn" if triggered else "OK", evidence)


def _coerce_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return {}
    return {}


async def evaluate_value(
    *,
    metric: str,
    aggregator: str,
    window_seconds: int,
) -> float | None:
    """Aggregate `metric` over the last `window_seconds`.

    Returns None when there are no points in the window, which the caller
    surfaces as "No Data".
    """
    pool = await get_pool()
    agg_sql = _AGG_SQL.get(aggregator, _AGG_SQL["avg"])
    sql = (
        f"SELECT {agg_sql} AS v FROM metric_points "
        f"WHERE name = $1 AND ts >= NOW() - make_interval(secs => $2)"
    )
    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql, metric, window_seconds)
    if row is None or row["v"] is None:
        return None
    return float(row["v"])


def status_for(
    value: float | None,
    *,
    operator: str,
    critical: float | None,
    warning: float | None,
) -> str:
    if value is None:
        return "No Data"
    op = _OPS.get(operator, _OPS[">"])
    if critical is not None and op(value, critical):
        return "Alert"
    if warning is not None and op(value, warning):
        return "Warn"
    return "OK"


async def evaluate_monitor(row: Any) -> tuple[str, str | None]:
    """Compute (status, error_or_none) for a single monitor row.

    Supports `metric`, `anomaly`, and `forecast` types. Other types return
    "No Data" — log/host etc. evaluators aren't implemented yet.
    """
    query = _coerce_dict(row["query"])
    thresholds = _coerce_dict(row["thresholds"])

    metric = query.get("metric")
    if not isinstance(metric, str) or not metric:
        return ("No Data", None)

    if row["type"] == "anomaly":
        window_seconds = int(query.get("windowSeconds") or 1800)
        deviations = float(query.get("deviations") or 2.0)
        direction = str(query.get("direction") or "both")
        series = await fetch_series(
            metric=metric,
            window_seconds=window_seconds,
            step_seconds=int(query.get("rollupSeconds") or 60),
        )
        status, _ = evaluate_anomaly(series, deviations=deviations, direction=direction)
        return (status, None)

    if row["type"] == "forecast":
        window_seconds = int(query.get("windowSeconds") or 3600)
        forecast_window = int(query.get("forecastWindowSeconds") or 3600)
        operator = thresholds.get("operator", ">")
        critical = thresholds.get("critical")
        if isinstance(critical, str):
            try:
                critical = float(critical)
            except ValueError:
                critical = None
        if critical is None:
            return ("No Data", None)
        series = await fetch_series(
            metric=metric,
            window_seconds=window_seconds,
            step_seconds=int(query.get("rollupSeconds") or 300),
        )
        status, _ = evaluate_forecast(
            series,
            forecast_window_seconds=forecast_window,
            threshold=float(critical),
            operator=operator,
        )
        return (status, None)

    if row["type"] != "metric":
        return ("No Data", None)

    aggregator = query.get("aggregator", "avg")
    window_seconds = int(query.get("windowSeconds") or 300)

    operator = thresholds.get("operator", ">")
    critical = thresholds.get("critical")
    warning = thresholds.get("warning")
    if isinstance(critical, str):
        try:
            critical = float(critical)
        except ValueError:
            critical = None
    if isinstance(warning, str):
        try:
            warning = float(warning)
        except ValueError:
            warning = None

    value = await evaluate_value(
        metric=metric,
        aggregator=aggregator,
        window_seconds=window_seconds,
    )
    return (status_for(value, operator=operator, critical=critical, warning=warning), None)


async def evaluate_all_once() -> int:
    """Evaluate every monitor once, write the new status. Returns count updated."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, type, query, thresholds, status FROM monitors"
        )
    if not rows:
        return 0

    updates: list[tuple[str, Any]] = []
    for r in rows:
        try:
            new_status, _err = await evaluate_monitor(r)
        except Exception:  # noqa: BLE001
            logger.exception("evaluator: failed monitor=%s", r["id"])
            continue
        if new_status != r["status"]:
            updates.append((new_status, r["id"]))

    if updates:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for status, mid in updates:
                    await conn.execute(
                        "UPDATE monitors SET status = $1, updated_at = NOW() WHERE id = $2",
                        status, mid,
                    )
    return len(updates)


async def evaluator_loop() -> None:
    logger.info("monitor.evaluator: loop start (interval=%ss)", EVAL_INTERVAL_SECONDS)
    while True:
        try:
            n = await evaluate_all_once()
            if n:
                logger.info("monitor.evaluator: updated %d monitor(s)", n)
        except Exception:  # noqa: BLE001
            logger.exception("monitor.evaluator: tick failed; will continue")
        await asyncio.sleep(EVAL_INTERVAL_SECONDS)
