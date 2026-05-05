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
