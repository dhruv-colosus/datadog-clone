"""Evaluate an SLO's SLI against the recorded metric_points.

`metric` SLOs: ratio of good / total events from a metric query (with optional
group filters via tag values). The evaluator buckets the rolling time window
to produce a burn-down series the frontend renders directly.

`monitor` SLOs: monitors don't have an evaluator yet (Phase 7), so we report
NO_DATA. The wiring is in place — once `monitors.evaluator` exists this can
read the monitor downtime log.

`time_slice` SLOs: count buckets where the SLI expression holds vs. total
buckets in the window.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from app.telemetry.pool import get_pool


_PROMOTED_TAG_COLUMNS = {"host", "service", "env", "name"}


def _ms_to_dt(ms: int) -> dt.datetime:
    return dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc)


def _step_seconds(window_seconds: int, target_points: int = 96) -> int:
    raw = max(1, window_seconds // target_points)
    for s in (60, 300, 600, 1800, 3600, 7200, 21600, 86400):
        if raw <= s:
            return s
    return raw


def _build_filters(
    filters: list[dict[str, Any]] | None,
    params: list[Any],
) -> list[str]:
    clauses: list[str] = []
    for flt in filters or []:
        values = flt.get("values") or []
        tag = flt.get("tag")
        if not tag or not values:
            continue
        operator = "IN" if (flt.get("operator") or "in") == "in" else "NOT IN"
        ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(values)))
        params.extend(values)
        if tag in _PROMOTED_TAG_COLUMNS:
            clauses.append(f"{tag} {operator} ({ph})")
        else:
            clauses.append(f"(tags ->> '{tag}') {operator} ({ph})")
    return clauses


async def _sum_metric(
    *,
    metric_name: str,
    filters: list[dict[str, Any]] | None,
    from_ms: int,
    to_ms: int,
) -> float:
    pool = await get_pool()
    where_parts = ["name = $1", "ts >= $2", "ts < $3"]
    params: list[Any] = [metric_name, _ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    where_parts.extend(_build_filters(filters, params))
    sql = f"""
        SELECT COALESCE(SUM(value), 0)::float8 AS total
        FROM metric_points
        WHERE {' AND '.join(where_parts)}
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql, *params)
    return float(row["total"] or 0)


async def _series_metric(
    *,
    metric_name: str,
    filters: list[dict[str, Any]] | None,
    from_ms: int,
    to_ms: int,
    step_seconds: int,
) -> list[tuple[int, float]]:
    pool = await get_pool()
    where_parts = ["name = $1", "ts >= $2", "ts < $3"]
    params: list[Any] = [metric_name, _ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    where_parts.extend(_build_filters(filters, params))
    sql = f"""
        SELECT
            time_bucket('{step_seconds} seconds'::interval, ts) AS bucket,
            COALESCE(SUM(value), 0)::float8 AS total
        FROM metric_points
        WHERE {' AND '.join(where_parts)}
        GROUP BY bucket
        ORDER BY bucket
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    return [(int(r["bucket"].timestamp() * 1000), float(r["total"])) for r in rows]


def _compute_metric_status(
    good: float,
    total: float,
    target_pct: float,
    warning_pct: float | None,
) -> dict[str, Any]:
    if total <= 0:
        return {
            "status": "no_data",
            "sliPct": None,
            "good": 0,
            "total": 0,
            "bad": 0,
            "errorBudgetRemainingPct": None,
        }
    bad = max(0.0, total - good)
    sli = (good / total) * 100
    allowed_bad = total * (100 - target_pct) / 100
    if allowed_bad <= 0:
        budget_remaining = 100.0 if bad <= 0 else 0.0
    else:
        budget_remaining = max(0.0, (1 - bad / allowed_bad) * 100)

    if sli < target_pct:
        status = "breached"
    elif warning_pct is not None and sli < warning_pct:
        status = "warn"
    else:
        status = "ok"

    return {
        "status": status,
        "sliPct": sli,
        "good": good,
        "total": total,
        "bad": bad,
        "errorBudgetRemainingPct": budget_remaining,
    }


async def evaluate_metric_slo(
    *,
    source: dict[str, Any],
    target_pct: float,
    warning_pct: float | None,
    from_ms: int,
    to_ms: int,
) -> dict[str, Any]:
    good_q = source.get("goodQuery") or {}
    total_q = source.get("totalQuery") or {}
    use_bad = bool(source.get("useBadEvents"))
    bad_q = source.get("badQuery") or {}

    good_metric = good_q.get("metricName") or ""
    total_metric = total_q.get("metricName") or ""
    bad_metric = bad_q.get("metricName") or ""

    if not good_metric or (not use_bad and not total_metric) or (use_bad and not bad_metric):
        return _compute_metric_status(0, 0, target_pct, warning_pct)

    good_total = await _sum_metric(
        metric_name=good_metric,
        filters=good_q.get("filters"),
        from_ms=from_ms,
        to_ms=to_ms,
    )

    if use_bad:
        bad_total = await _sum_metric(
            metric_name=bad_metric,
            filters=bad_q.get("filters"),
            from_ms=from_ms,
            to_ms=to_ms,
        )
        total = good_total + bad_total
        return _compute_metric_status(good_total, total, target_pct, warning_pct)

    total = await _sum_metric(
        metric_name=total_metric,
        filters=total_q.get("filters"),
        from_ms=from_ms,
        to_ms=to_ms,
    )
    return _compute_metric_status(good_total, total, target_pct, warning_pct)


async def burndown_series(
    *,
    source: dict[str, Any],
    target_pct: float,
    from_ms: int,
    to_ms: int,
) -> dict[str, Any]:
    """Cumulative SLI + error budget remaining over the window.

    Frontend renders the budget-remaining series as a step chart. We bucket
    the window so the chart has ~96 points regardless of window length.
    """
    good_q = source.get("goodQuery") or {}
    total_q = source.get("totalQuery") or {}
    use_bad = bool(source.get("useBadEvents"))
    bad_q = source.get("badQuery") or {}

    window_seconds = max(1, (to_ms - from_ms) // 1000)
    step = _step_seconds(window_seconds)

    good_series = await _series_metric(
        metric_name=good_q.get("metricName") or "",
        filters=good_q.get("filters"),
        from_ms=from_ms,
        to_ms=to_ms,
        step_seconds=step,
    ) if good_q.get("metricName") else []

    if use_bad:
        other_series = await _series_metric(
            metric_name=bad_q.get("metricName") or "",
            filters=bad_q.get("filters"),
            from_ms=from_ms,
            to_ms=to_ms,
            step_seconds=step,
        ) if bad_q.get("metricName") else []
    else:
        other_series = await _series_metric(
            metric_name=total_q.get("metricName") or "",
            filters=total_q.get("filters"),
            from_ms=from_ms,
            to_ms=to_ms,
            step_seconds=step,
        ) if total_q.get("metricName") else []

    buckets: dict[int, dict[str, float]] = {}
    for t, v in good_series:
        buckets.setdefault(t, {"good": 0.0, "other": 0.0})["good"] += v
    for t, v in other_series:
        buckets.setdefault(t, {"good": 0.0, "other": 0.0})["other"] += v

    cum_good = 0.0
    cum_total = 0.0
    points: list[dict[str, Any]] = []
    target_frac = target_pct / 100
    for t in sorted(buckets.keys()):
        b = buckets[t]
        cum_good += b["good"]
        if use_bad:
            cum_total += b["good"] + b["other"]
        else:
            cum_total += b["other"]
        bad = max(0.0, cum_total - cum_good)
        sli = (cum_good / cum_total * 100) if cum_total > 0 else None
        allowed_bad = cum_total * (1 - target_frac) if cum_total > 0 else 0
        if cum_total <= 0:
            budget_pct: float | None = None
        elif allowed_bad <= 0:
            budget_pct = 100.0 if bad <= 0 else 0.0
        else:
            budget_pct = max(0.0, (1 - bad / allowed_bad) * 100)
        points.append({
            "t": t,
            "sliPct": sli,
            "errorBudgetRemainingPct": budget_pct,
            "goodCum": cum_good,
            "totalCum": cum_total,
        })

    return {
        "stepSeconds": step,
        "fromMs": from_ms,
        "toMs": to_ms,
        "points": points,
    }


async def evaluate_monitor_slo(*, source: dict[str, Any]) -> dict[str, Any]:
    # No monitor evaluator yet — surface NO_DATA but keep the contract stable.
    return {
        "status": "no_data",
        "sliPct": None,
        "good": 0,
        "total": 0,
        "bad": 0,
        "errorBudgetRemainingPct": None,
    }


async def evaluate_time_slice_slo(
    *,
    source: dict[str, Any],
    target_pct: float,
    warning_pct: float | None,
    from_ms: int,
    to_ms: int,
) -> dict[str, Any]:
    """Count buckets where the metric satisfies `comparator threshold`.

    `source` shape: { query: MetricQuery-shaped, comparator: "<"|"<="|">"|">=", threshold: float }
    Each bucket is one "slice"; the SLI is good_buckets / total_buckets.
    """
    query = source.get("query") or {}
    metric_name = query.get("metricName") or ""
    comparator = source.get("comparator") or "<"
    threshold = float(source.get("threshold", 0))
    if not metric_name:
        return _compute_metric_status(0, 0, target_pct, warning_pct)

    window_seconds = max(1, (to_ms - from_ms) // 1000)
    step = _step_seconds(window_seconds)

    series = await _series_metric(
        metric_name=metric_name,
        filters=query.get("filters"),
        from_ms=from_ms,
        to_ms=to_ms,
        step_seconds=step,
    )
    good = 0
    for _t, value in series:
        ok = (
            (comparator == "<" and value < threshold)
            or (comparator == "<=" and value <= threshold)
            or (comparator == ">" and value > threshold)
            or (comparator == ">=" and value >= threshold)
        )
        if ok:
            good += 1
    total = len(series)
    return _compute_metric_status(good, total, target_pct, warning_pct)


async def evaluate_slo(
    *,
    slo_type: str,
    source: dict[str, Any],
    target_pct: float,
    warning_pct: float | None,
    from_ms: int,
    to_ms: int,
) -> dict[str, Any]:
    if slo_type == "metric":
        return await evaluate_metric_slo(
            source=source,
            target_pct=target_pct,
            warning_pct=warning_pct,
            from_ms=from_ms,
            to_ms=to_ms,
        )
    if slo_type == "monitor":
        return await evaluate_monitor_slo(source=source)
    if slo_type == "time_slice":
        return await evaluate_time_slice_slo(
            source=source,
            target_pct=target_pct,
            warning_pct=warning_pct,
            from_ms=from_ms,
            to_ms=to_ms,
        )
    return _compute_metric_status(0, 0, target_pct, warning_pct)
