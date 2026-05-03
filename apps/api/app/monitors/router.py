"""Monitors CRUD (no evaluator yet — Phase 7)."""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User


router = APIRouter(prefix="/monitors", tags=["monitors"])


class MonitorCreate(BaseModel):
    name: str
    type: str = "metric"
    query: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    message: str | None = None
    recovery_message: str | None = None
    impact: str | None = None
    runbook_steps: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    priority: int | None = None
    team: str | None = None


class MonitorPatch(BaseModel):
    name: str | None = None
    type: str | None = None
    query: dict[str, Any] | None = None
    thresholds: dict[str, Any] | None = None
    message: str | None = None
    recovery_message: str | None = None
    impact: str | None = None
    runbook_steps: list[str] | None = None
    tags: list[str] | None = None
    priority: int | None = None
    team: str | None = None
    muted: bool | None = None


def _row_to_dict(row) -> dict[str, Any]:
    query = row.query if isinstance(row.query, dict) else json.loads(row.query or "{}")
    thresholds = (
        row.thresholds if isinstance(row.thresholds, dict)
        else json.loads(row.thresholds or "{}")
    )
    runbook = (
        row.runbook_steps if isinstance(row.runbook_steps, list)
        else json.loads(row.runbook_steps or "[]")
    )
    return {
        "id": str(row.id),
        "name": row.name,
        "type": row.type,
        "status": "No Data",  # evaluator deferred
        "priority": row.priority,
        "tags": list(row.tags or []),
        "query": query,
        "thresholds": thresholds,
        "message": row.message,
        "recoveryMessage": row.recovery_message,
        "impact": row.impact,
        "runbookSteps": runbook,
        "team": row.team,
        "muted": row.muted,
        "createdMs": int(row.created_at.timestamp() * 1000),
    }


_SELECT = (
    "SELECT id, owner_id, name, type, query, thresholds, message, "
    "recovery_message, impact, runbook_steps, tags, priority, team, muted, "
    "created_at, updated_at FROM monitors"
)


@router.get("")
async def list_monitors(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(_SELECT + " WHERE owner_id = :uid ORDER BY updated_at DESC"),
        {"uid": user.id},
    )
    return [_row_to_dict(r) for r in res]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_monitor(
    body: MonitorCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO monitors (
                id, owner_id, name, type, query, thresholds, message,
                recovery_message, impact, runbook_steps, tags, priority, team
            ) VALUES (
                :id, :owner, :name, :type,
                CAST(:query AS jsonb), CAST(:thresholds AS jsonb),
                :message, :recovery, :impact,
                CAST(:runbook AS jsonb), :tags, :priority, :team
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": body.name,
            "type": body.type,
            "query": json.dumps(body.query),
            "thresholds": json.dumps(body.thresholds),
            "message": body.message,
            "recovery": body.recovery_message,
            "impact": body.impact,
            "runbook": json.dumps(body.runbook_steps),
            "tags": body.tags,
            "priority": body.priority,
            "team": body.team,
        },
    )
    await db.commit()
    return await get_monitor(str(new_id), user, db)


@router.get("/{monitor_id}")
async def get_monitor(
    monitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_SELECT + " WHERE id = :id"),
        {"id": monitor_id},
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return _row_to_dict(row)


@router.patch("/{monitor_id}")
async def patch_monitor(
    monitor_id: str,
    body: MonitorPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return await get_monitor(monitor_id, user, db)
    set_parts: list[str] = []
    params: dict[str, Any] = {"id": monitor_id, "uid": user.id}
    for key, val in fields.items():
        if key in ("query", "thresholds", "runbook_steps"):
            params[key] = json.dumps(val) if val is not None else None
            set_parts.append(f"{key} = CAST(:{key} AS jsonb)")
        elif key == "tags":
            params["tags"] = list(val or [])
            set_parts.append("tags = :tags")
        else:
            params[key] = val
            set_parts.append(f"{key} = :{key}")
    set_parts.append("updated_at = NOW()")
    sql = (
        f"UPDATE monitors SET {', '.join(set_parts)} "
        f"WHERE id = :id AND owner_id = :uid RETURNING id"
    )
    res = await db.execute(text(sql), params)
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    await db.commit()
    return await get_monitor(monitor_id, user, db)


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(
    monitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text("DELETE FROM monitors WHERE id = :id AND owner_id = :uid RETURNING id"),
        {"id": monitor_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    await db.commit()


@router.post("/{monitor_id}/mute")
async def mute_monitor(
    monitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("UPDATE monitors SET muted = TRUE, updated_at = NOW() "
             "WHERE id = :id AND owner_id = :uid"),
        {"id": monitor_id, "uid": user.id},
    )
    await db.commit()
    return await get_monitor(monitor_id, user, db)


@router.post("/{monitor_id}/unmute")
async def unmute_monitor(
    monitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("UPDATE monitors SET muted = FALSE, updated_at = NOW() "
             "WHERE id = :id AND owner_id = :uid"),
        {"id": monitor_id, "uid": user.id},
    )
    await db.commit()
    return await get_monitor(monitor_id, user, db)
