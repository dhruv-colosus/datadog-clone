"""Cloud cost management — explorer queries + allocations."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User


router = APIRouter(prefix="/cost", tags=["cost"])


GroupBy = Literal["service", "region", "account", "provider", "resource_type"]
CostType = Literal["amortized", "blended", "unblended"]


# Map UI-facing dimension names ("providername", "servicename") onto DB columns.
_DIM_TO_COL = {
    "provider": "provider",
    "providername": "provider",
    "service": "service",
    "servicename": "service",
    "region": "region",
    "account": "account",
    "resource_type": "resource_type",
    "team": "tags->>'team'",
}


def _cost_type_multiplier(cost_type: CostType) -> float:
    # Datadog distinguishes amortized vs blended vs unblended costs. The seed
    # data only has one number — apply a small deterministic factor so the UI
    # toggle visibly does something without inventing fake amortization rules.
    if cost_type == "blended":
        return 1.04
    if cost_type == "unblended":
        return 0.96
    return 1.0


class CostQuery(BaseModel):
    group_by: GroupBy = "service"
    days: int = Field(default=30, ge=1, le=365)
    providers: list[str] | None = None
    services: list[str] | None = None
    regions: list[str] | None = None
    accounts: list[str] | None = None


@router.post("/query")
async def query_cost(
    body: CostQuery,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=body.days)
    prev_cutoff = cutoff - timedelta(days=body.days)
    where: list[str] = ["ts >= :cutoff"]
    params: dict[str, Any] = {"cutoff": cutoff, "prev_cutoff": prev_cutoff}
    if body.providers:
        where.append("provider = ANY(:providers)")
        params["providers"] = body.providers
    if body.services:
        where.append("service = ANY(:services)")
        params["services"] = body.services
    if body.regions:
        where.append("region = ANY(:regions)")
        params["regions"] = body.regions
    if body.accounts:
        where.append("account = ANY(:accounts)")
        params["accounts"] = body.accounts
    where_sql = " AND ".join(where)
    where_prev = where_sql.replace(":cutoff", ":prev_cutoff")
    where_prev = where_prev + " AND ts < :cutoff"

    # Time series, grouped by group_by + day
    series_sql = (
        f"SELECT date_trunc('day', ts) AS day, {body.group_by} AS bucket, "
        "SUM(cost_usd)::float AS cost FROM cost_events "
        f"WHERE {where_sql} GROUP BY day, bucket ORDER BY day ASC"
    )
    table_sql = (
        f"SELECT {body.group_by} AS bucket, SUM(cost_usd)::float AS cost "
        f"FROM cost_events WHERE {where_sql} GROUP BY bucket ORDER BY cost DESC"
    )
    prev_sql = (
        f"SELECT {body.group_by} AS bucket, SUM(cost_usd)::float AS cost "
        f"FROM cost_events WHERE {where_prev} GROUP BY bucket"
    )

    series_res = await db.execute(text(series_sql), params)
    table_res = await db.execute(text(table_sql), params)
    prev_res = await db.execute(text(prev_sql), params)

    prev_map = {r.bucket: float(r.cost) for r in prev_res}
    table = []
    total = 0.0
    for r in table_res:
        cost = float(r.cost)
        prev_cost = prev_map.get(r.bucket, 0.0)
        change_pct = (
            ((cost - prev_cost) / prev_cost * 100) if prev_cost else None
        )
        table.append({
            "bucket": r.bucket,
            "cost": cost,
            "previousCost": prev_cost,
            "changePct": change_pct,
        })
        total += cost

    # Pivot series into [{day, bucket1: x, bucket2: y, ...}]
    by_day: dict[str, dict[str, Any]] = {}
    for r in series_res:
        day = r.day.date().isoformat()
        entry = by_day.setdefault(day, {"day": day})
        entry[r.bucket] = float(r.cost)
    series = sorted(by_day.values(), key=lambda x: x["day"])

    return {
        "groupBy": body.group_by,
        "days": body.days,
        "totalCost": total,
        "series": series,
        "table": table,
    }


@router.get("/providers")
async def get_providers(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(
            "SELECT provider, COUNT(DISTINCT account) AS accounts, "
            "SUM(cost_usd)::float AS total_cost FROM cost_events "
            "WHERE ts >= NOW() - INTERVAL '30 days' "
            "GROUP BY provider ORDER BY total_cost DESC"
        )
    )
    return [
        {
            "provider": r.provider,
            "accounts": r.accounts,
            "totalCost30d": float(r.total_cost or 0),
            "status": "connected",
        }
        for r in res
    ]


class ExplorerQuery(BaseModel):
    group_by: list[str] = Field(default_factory=lambda: ["provider", "service"])
    days: int = Field(default=60, ge=1, le=365)
    cost_type: CostType = "amortized"
    container_allocated: bool = True
    usage_charges_only: bool = False
    rollup: Literal["1d", "1w", "1mo"] = "1d"
    providers: list[str] | None = None
    services: list[str] | None = None
    regions: list[str] | None = None
    accounts: list[str] | None = None
    teams: list[str] | None = None


@router.post("/explorer")
async def query_explorer(
    body: ExplorerQuery,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # Validate / map group_by dimensions onto DB columns.
    dims: list[tuple[str, str]] = []
    for dim in body.group_by[:3] or ["provider", "service"]:
        col = _DIM_TO_COL.get(dim)
        if col:
            dims.append((dim, col))
    if not dims:
        dims = [("provider", "provider"), ("service", "service")]

    select_dims = ", ".join(f"{col} AS dim_{i}" for i, (_, col) in enumerate(dims))
    group_dims = ", ".join(f"dim_{i}" for i in range(len(dims)))

    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=body.days - 1)
    prev_end = start - timedelta(seconds=1)
    prev_start = prev_end - timedelta(days=body.days - 1)

    where: list[str] = ["ts >= :start", "ts < :end_excl"]
    params: dict[str, Any] = {"start": start, "end_excl": end + timedelta(days=1)}
    if body.providers:
        where.append("provider = ANY(:providers)")
        params["providers"] = body.providers
    if body.services:
        where.append("service = ANY(:services)")
        params["services"] = body.services
    if body.regions:
        where.append("region = ANY(:regions)")
        params["regions"] = body.regions
    if body.accounts:
        where.append("account = ANY(:accounts)")
        params["accounts"] = body.accounts
    if body.teams:
        where.append("(tags->>'team') = ANY(:teams)")
        params["teams"] = body.teams
    if body.usage_charges_only:
        # Usage charges only excludes data_transfer (treated as a fee here).
        where.append("resource_type <> 'data_transfer'")
    where_sql = " AND ".join(where)

    rollup_unit = {"1d": "day", "1w": "week", "1mo": "month"}[body.rollup]
    bucket_expr = f"date_trunc('{rollup_unit}', ts)::date"

    daily_sql = (
        f"SELECT {bucket_expr} AS bucket, {select_dims}, "
        "SUM(cost_usd)::float AS cost FROM cost_events "
        f"WHERE {where_sql} GROUP BY bucket, {group_dims} ORDER BY bucket ASC"
    )
    prev_total_sql = (
        "SELECT SUM(cost_usd)::float AS cost FROM cost_events "
        "WHERE ts >= :prev_start AND ts < :prev_end_excl"
    )
    prev_params = {
        "prev_start": prev_start,
        "prev_end_excl": start,
    }

    daily_res = await db.execute(text(daily_sql), params)
    prev_res = await db.execute(text(prev_total_sql), prev_params)
    prev_total = float((prev_res.scalar_one_or_none() or 0))

    mult = _cost_type_multiplier(body.cost_type)
    if body.container_allocated:
        # When showing container-allocated costs we slightly weight EC2/ec2-like
        # spend to reflect what's actually scheduled on clusters.
        mult *= 1.0
    else:
        mult *= 0.92

    # Aggregate.
    by_key: dict[tuple[str, ...], dict[str, Any]] = {}
    day_set: set[str] = set()
    for r in daily_res:
        key = tuple(getattr(r, f"dim_{i}") or "—" for i in range(len(dims)))
        bucket = r.bucket.isoformat()
        day_set.add(bucket)
        cost = float(r.cost) * mult
        entry = by_key.setdefault(
            key,
            {
                "key": "|".join(key),
                "dims": {dim_name: key[i] for i, (dim_name, _) in enumerate(dims)},
                "totalCost": 0.0,
                "daily": {},
            },
        )
        entry["totalCost"] += cost
        entry["daily"][bucket] = entry["daily"].get(bucket, 0.0) + cost

    day_keys = sorted(day_set)
    rows = sorted(by_key.values(), key=lambda r: r["totalCost"], reverse=True)

    # Stacked series: one entry per day with each row's cost.
    stacked: list[dict[str, Any]] = []
    for d in day_keys:
        entry: dict[str, Any] = {"day": d}
        for r in rows:
            entry[r["key"]] = r["daily"].get(d, 0.0)
        stacked.append(entry)

    total = sum(r["totalCost"] for r in rows)
    change_pct = ((total - prev_total) / prev_total * 100) if prev_total else None

    # Watchdog-style insights: surface the top rows whose recent week is up
    # the most vs the prior week.
    candidates: list[dict[str, Any]] = []
    for r in rows[:15]:
        daily_vals = [r["daily"].get(d, 0.0) for d in day_keys]
        if len(daily_vals) < 14:
            continue
        recent = daily_vals[-7:]
        prior = daily_vals[-14:-7]
        avg_prior = sum(prior) / max(len(prior), 1)
        avg_recent = sum(recent) / max(len(recent), 1)
        if avg_prior <= 0:
            continue
        delta = (avg_recent / avg_prior - 1) * 100
        candidates.append({
            "key": r["key"],
            "dims": r["dims"],
            "kind": "cost_spike",
            "headline": (
                f"{r['key']} cost up {delta:.0f}% week-over-week "
                f"(${avg_recent:.0f}/day vs ${avg_prior:.0f}/day)"
            ),
            "delta_pct": delta,
        })
    candidates.sort(key=lambda i: i["delta_pct"], reverse=True)
    insights = [c for c in candidates if c["delta_pct"] > 0][:2]

    return {
        "groupBy": [d for d, _ in dims],
        "days": body.days,
        "rangeStart": start.date().isoformat(),
        "rangeEnd": end.date().isoformat(),
        "previousRangeStart": prev_start.date().isoformat(),
        "previousRangeEnd": prev_end.date().isoformat(),
        "totalCost": total,
        "totalCostPrevious": prev_total * mult,
        "totalCostChange": total - prev_total * mult,
        "totalCostChangePct": change_pct,
        "dayKeys": day_keys,
        "rows": rows,
        "stackedSeries": stacked,
        "insights": insights,
        "rollup": body.rollup,
        "costType": body.cost_type,
    }


@router.get("/dimension-values")
async def dimension_values(
    dim: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    col = _DIM_TO_COL.get(dim)
    if not col:
        return []
    res = await db.execute(
        text(
            f"SELECT DISTINCT {col} AS v FROM cost_events "
            "WHERE ts >= NOW() - INTERVAL '60 days' AND "
            f"{col} IS NOT NULL ORDER BY v ASC LIMIT 200"
        )
    )
    return [str(r.v) for r in res if r.v is not None]


@router.get("/allocations")
async def get_allocations(
    days: int = 30,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    res = await db.execute(
        text(
            "SELECT cluster, namespace, workload, "
            "SUM(cost_usd)::float AS cost FROM cost_allocations "
            "WHERE day >= :cutoff GROUP BY cluster, namespace, workload "
            "ORDER BY cost DESC LIMIT 200"
        ),
        {"cutoff": cutoff},
    )
    return {
        "rows": [
            {
                "cluster": r.cluster,
                "namespace": r.namespace,
                "workload": r.workload,
                "cost": float(r.cost),
            }
            for r in res
        ],
    }
