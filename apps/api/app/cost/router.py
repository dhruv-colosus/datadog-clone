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
