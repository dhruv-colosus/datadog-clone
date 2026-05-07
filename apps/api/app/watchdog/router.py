"""Watchdog stories — auto-detected anomalies surfaced to users."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User


router = APIRouter(prefix="/watchdog", tags=["watchdog"])


def _row_to_dict(row) -> dict[str, Any]:
    evidence = (
        row.evidence
        if isinstance(row.evidence, dict)
        else json.loads(row.evidence or "{}")
    )
    return {
        "id": str(row.id),
        "kind": row.kind,
        "title": row.title,
        "narrative": row.narrative,
        "severity": row.severity,
        "status": row.status,
        "service": row.service,
        "host": row.host,
        "metric": row.metric,
        "evidence": evidence,
        "startedMs": int(row.started_at.timestamp() * 1000),
        "endedMs": (
            int(row.ended_at.timestamp() * 1000) if row.ended_at else None
        ),
        "createdMs": int(row.created_at.timestamp() * 1000),
    }


_SELECT = (
    "SELECT id, kind, title, narrative, severity, status, service, host, "
    "metric, evidence, started_at, ended_at, created_at, updated_at "
    "FROM watchdog_stories"
)


@router.get("/stories")
async def list_stories(
    severity: list[str] | None = Query(default=None),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    service: list[str] | None = Query(default=None),
    kind: list[str] | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    sql = _SELECT
    where: list[str] = []
    params: dict[str, Any] = {}
    if severity:
        where.append("severity = ANY(:severities)")
        params["severities"] = severity
    if status_filter:
        where.append("status = ANY(:statuses)")
        params["statuses"] = status_filter
    if service:
        where.append("service = ANY(:services)")
        params["services"] = service
    if kind:
        where.append("kind = ANY(:kinds)")
        params["kinds"] = kind
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY started_at DESC LIMIT :limit"
    params["limit"] = limit
    res = await db.execute(text(sql), params)
    return [_row_to_dict(r) for r in res]


@router.get("/summary")
async def watchdog_summary(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """High-level Watchdog stats for the redesigned overview header."""
    counts_res = await db.execute(
        text(
            "SELECT status, severity, COUNT(*) AS c "
            "FROM watchdog_stories "
            "WHERE started_at >= NOW() - INTERVAL '7 days' "
            "GROUP BY status, severity"
        )
    )
    by_status: dict[str, int] = {"active": 0, "acknowledged": 0, "resolved": 0}
    by_severity: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    for row in counts_res:
        by_status[row.status] = by_status.get(row.status, 0) + int(row.c)
        by_severity[row.severity] = by_severity.get(row.severity, 0) + int(row.c)

    kind_res = await db.execute(
        text(
            "SELECT kind, COUNT(*) AS c FROM watchdog_stories "
            "WHERE started_at >= NOW() - INTERVAL '7 days' GROUP BY kind"
        )
    )
    by_kind = {row.kind: int(row.c) for row in kind_res}

    services_res = await db.execute(
        text(
            "SELECT COUNT(DISTINCT service) AS c FROM watchdog_stories "
            "WHERE status = 'active'"
        )
    )
    services_impacted = int(services_res.scalar() or 0)

    last24_res = await db.execute(
        text(
            "SELECT COUNT(*) FROM watchdog_stories "
            "WHERE started_at >= NOW() - INTERVAL '24 hours'"
        )
    )
    last_24h = int(last24_res.scalar() or 0)

    max_sigma_res = await db.execute(
        text(
            "SELECT MAX((evidence->>'sigmas')::float) FROM watchdog_stories "
            "WHERE status = 'active' AND evidence ? 'sigmas'"
        )
    )
    max_sigma = max_sigma_res.scalar()

    latest_res = await db.execute(
        text(
            "SELECT MAX(started_at) FROM watchdog_stories"
        )
    )
    latest_at = latest_res.scalar()

    return {
        "byStatus": by_status,
        "bySeverity": by_severity,
        "byKind": by_kind,
        "servicesImpacted": services_impacted,
        "last24h": last_24h,
        "maxSigma": float(max_sigma) if max_sigma is not None else None,
        "latestStartedMs": (
            int(latest_at.timestamp() * 1000) if latest_at else None
        ),
    }


@router.get("/timeline")
async def watchdog_timeline(
    hours: int = Query(default=24, ge=1, le=168),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Bucketed activity per service for the timeline lane visualization."""
    res = await db.execute(
        text(
            "SELECT id, service, severity, status, started_at, "
            "title, kind, "
            "(evidence->>'sigmas')::float AS sigmas "
            "FROM watchdog_stories "
            "WHERE started_at >= NOW() - make_interval(hours => :h) "
            "ORDER BY started_at"
        ),
        {"h": hours},
    )
    services: dict[str, list[dict[str, Any]]] = {}
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    window_ms = hours * 3600 * 1000
    start_ms = now_ms - window_ms
    for row in res:
        svc = row.service
        services.setdefault(svc, []).append(
            {
                "id": str(row.id),
                "severity": row.severity,
                "status": row.status,
                "kind": row.kind,
                "title": row.title,
                "startedMs": int(row.started_at.timestamp() * 1000),
                "sigmas": float(row.sigmas) if row.sigmas is not None else None,
            }
        )
    return {
        "windowMs": window_ms,
        "startMs": start_ms,
        "endMs": now_ms,
        "services": [
            {"service": svc, "events": evts} for svc, evts in services.items()
        ],
    }


@router.get("/stories/{story_id}")
async def get_story(
    story_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_SELECT + " WHERE id = :id"), {"id": story_id}
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return _row_to_dict(row)


class StoryPatch(BaseModel):
    status: Literal["active", "acknowledged", "resolved"] | None = None


@router.patch("/stories/{story_id}")
async def patch_story(
    story_id: str,
    body: StoryPatch,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if body.status is None:
        return await get_story(story_id, _user, db)
    ended_at = datetime.now(timezone.utc) if body.status == "resolved" else None
    await db.execute(
        text(
            "UPDATE watchdog_stories SET status = :s, "
            "ended_at = COALESCE(:ended, ended_at), updated_at = NOW() "
            "WHERE id = :id"
        ),
        {"s": body.status, "ended": ended_at, "id": story_id},
    )
    await db.commit()
    return await get_story(story_id, _user, db)
