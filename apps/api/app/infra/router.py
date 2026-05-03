"""Infrastructure endpoints — host list, host detail, processes, containers, map."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.telemetry import queries
from app.telemetry.pool import get_pool


router = APIRouter(prefix="/infra", tags=["infrastructure"])


@router.get("/hosts")
async def list_hosts(
    env: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return await queries.hosts_with_metrics(env=env)


@router.get("/hosts/{host_id}")
async def get_host(
    host_id: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    detail = await queries.host_detail(host_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Host not found")
    return detail


@router.get("/hosts/{host_id}/processes")
async def get_host_processes(
    host_id: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return await queries.host_processes(host_id)


@router.get("/hosts/{host_id}/containers")
async def get_host_containers(
    host_id: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return await queries.host_containers(host_id)


@router.get("/map")
async def get_host_map(
    fillBy: str = Query("system.cpu.user"),
    groupBy: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Hex-map data: each host with its current value of `fillBy`."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        host_rows = await conn.fetch(
            "SELECT id, hostname, role, env, region, availability_zone, "
            "       service, version, team "
            "FROM topology_hosts ORDER BY hostname"
        )
        # Latest value of fillBy per host within last 10m
        value_rows = await conn.fetch(
            """
            SELECT DISTINCT ON (host) host, value
            FROM metric_points
            WHERE name = $1 AND ts >= NOW() - INTERVAL '10 minutes'
            ORDER BY host, ts DESC
            """,
            fillBy,
        )
    by_host = {r["host"]: float(r["value"]) for r in value_rows if r["host"]}
    return [
        {
            "id": r["id"],
            "hostname": r["hostname"],
            "role": r["role"],
            "env": r["env"],
            "region": r["region"],
            "availabilityZone": r["availability_zone"],
            "service": r["service"],
            "version": r["version"],
            "team": r["team"],
            "value": by_host.get(r["id"], 0.0),
        }
        for r in host_rows
    ]
