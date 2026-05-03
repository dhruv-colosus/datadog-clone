"""Saved-views CRUD (logs / metrics / apm)."""

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


router = APIRouter(prefix="/views", tags=["views"])


class SavedViewCreate(BaseModel):
    kind: str  # 'metrics' | 'logs' | 'apm'
    name: str
    state: dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False
    team: str | None = None


@router.get("")
async def list_views(
    kind: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, kind, name, state, is_default, team "
        "FROM saved_views WHERE owner_id = :uid"
    )
    params: dict[str, Any] = {"uid": user.id}
    if kind:
        sql += " AND kind = :kind"
        params["kind"] = kind
    sql += " ORDER BY created_at DESC"
    res = await db.execute(text(sql), params)
    out: list[dict[str, Any]] = []
    for r in res:
        state = r.state if isinstance(r.state, dict) else json.loads(r.state or "{}")
        out.append({
            "id": str(r.id),
            "kind": r.kind,
            "name": r.name,
            "state": state,
            "isDefault": r.is_default,
            "team": r.team,
        })
    return out


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_view(
    body: SavedViewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO saved_views (id, owner_id, kind, name, state, is_default, team)
            VALUES (:id, :uid, :kind, :name, CAST(:state AS jsonb), :is_default, :team)
            """
        ),
        {
            "id": new_id,
            "uid": user.id,
            "kind": body.kind,
            "name": body.name,
            "state": json.dumps(body.state),
            "is_default": body.is_default,
            "team": body.team,
        },
    )
    await db.commit()
    return {
        "id": str(new_id),
        "kind": body.kind,
        "name": body.name,
        "state": body.state,
        "isDefault": body.is_default,
        "team": body.team,
    }


@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_view(
    view_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text("DELETE FROM saved_views WHERE id = :id AND owner_id = :uid RETURNING id"),
        {"id": view_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="View not found")
    await db.commit()
