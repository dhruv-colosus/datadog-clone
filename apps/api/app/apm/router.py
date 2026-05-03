"""APM endpoints — match `apps/web/src/features/apm/api.ts`."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.telemetry import queries
from app.telemetry.pool import get_pool
from app.telemetry.topology import (
    DEPENDENCIES,
    SERVICES,
    callees_of,
    Service,
)


router = APIRouter(prefix="/apm", tags=["apm"])


def _service_to_dict(s: Service, stats: dict[str, Any] | None) -> dict[str, Any]:
    health = "ok"
    error_rate = stats.get("errorRate") if stats else 0.0
    if error_rate is not None and error_rate > 0.05:
        health = "critical"
    elif error_rate is not None and error_rate > 0.01:
        health = "warn"
    return {
        "id": s.name,
        "name": s.name,
        "type": s.type,
        "language": s.language or "n/a",
        "env": "prod",
        "health": health,
        "requestsPerSec": stats["rps"] if stats else 0.0,
        "errorRate": stats["errorRate"] if stats else None,
        "p99LatencyMs": stats["p99LatencyMs"] if stats else 0.0,
        "p95LatencyMs": stats["p95LatencyMs"] if stats else 0.0,
        "totalRequests": stats["hits"] if stats else 0,
        "totalErrors": stats["errors"] if stats else 0,
        "lastDeployMinutesAgo": None,
    }


@router.get("/services")
async def list_services(
    env: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    stats = await queries.apm_service_stats(env=env)
    by_name = {s["name"]: s for s in stats}
    return [_service_to_dict(s, by_name.get(s.name)) for s in SERVICES]


@router.get("/services/{name}")
async def get_service(
    name: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    service = next((s for s in SERVICES if s.name == name), None)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    stats = await queries.apm_service_stats()
    by_name = {s["name"]: s for s in stats}
    return _service_to_dict(service, by_name.get(name))


@router.get("/services/{name}/operations")
async def list_operations(
    name: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT operation, COUNT(*) AS hits,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
                   percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us
            FROM spans
            WHERE service = $1 AND ts >= NOW() - INTERVAL '15 minutes'
            GROUP BY operation ORDER BY hits DESC
            """,
            name,
        )
    return [
        {
            "name": r["operation"],
            "hits": int(r["hits"] or 0),
            "errors": int(r["errors"] or 0),
            "p95LatencyMs": float(r["p95_us"] or 0) / 1000.0,
        }
        for r in rows
    ]


@router.get("/services/{name}/resources")
async def list_resources(
    name: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT resource, COUNT(*) AS hits,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
                   SUM(duration_us)::float8 / 1000 AS total_ms,
                   percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us
            FROM spans
            WHERE service = $1 AND ts >= NOW() - INTERVAL '15 minutes'
            GROUP BY resource ORDER BY hits DESC LIMIT 50
            """,
            name,
        )
    out: list[dict[str, Any]] = []
    for i, r in enumerate(rows):
        hits = int(r["hits"] or 0)
        errors = int(r["errors"] or 0)
        out.append({
            "id": f"{name}-{i}",
            "name": r["resource"],
            "service": name,
            "requests": hits,
            "totalTimeMs": float(r["total_ms"] or 0),
            "p95LatencyMs": float(r["p95_us"] or 0) / 1000.0,
            "errors": errors,
            "errorRate": (errors / hits) if hits else 0.0,
        })
    return out


@router.get("/services/{name}/series")
async def get_service_series(
    name: str,
    fromMs: int = Query(...),
    toMs: int = Query(...),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    pts = await queries.apm_service_series(service=name, from_ms=fromMs, to_ms=toMs)
    return {"service": name, "points": pts}


@router.get("/dependencies")
async def get_dependencies(
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return [
        {"caller": d.caller, "callee": d.callee, "kind": d.kind, "weight": d.weight}
        for d in DEPENDENCIES
    ]


@router.get("/traces/{trace_id}")
async def get_trace(
    trace_id: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    spans = await queries.apm_get_trace(trace_id)
    if not spans:
        raise HTTPException(status_code=404, detail="Trace not found")
    return {"traceId": trace_id, "spans": spans}


@router.get("/recommendations")
async def list_recommendations(
    type: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    fixture = [
        {"id": "r1", "title": "Reduce p99 on api.web.request",
         "type": "performance", "service": "api",
         "description": "p99 climbed >150ms over the last hour."},
        {"id": "r2", "title": "Add retry on payments.charge",
         "type": "reliability", "service": "payments",
         "description": "Error rate spiked above 2% — consider exponential backoff."},
        {"id": "r3", "title": "Drop unused indexes on `orders`",
         "type": "cost", "service": "postgres",
         "description": "Disk usage grew faster than table growth."},
    ]
    if type:
        return [r for r in fixture if r["type"] == type]
    return fixture
