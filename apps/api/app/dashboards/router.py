"""Dashboards CRUD + public-share endpoint."""

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


router = APIRouter(prefix="/dashboards", tags=["dashboards"])


class WidgetQueryModel(BaseModel):
    id: str
    alias: str = ""
    metricName: str
    aggregator: str = "avg"
    filters: list[dict[str, Any]] = Field(default_factory=list)
    groupBy: list[str] = Field(default_factory=list)


class WidgetModel(BaseModel):
    id: str
    type: str
    title: str
    queries: list[WidgetQueryModel] = Field(default_factory=list)
    display: str | None = None
    # Per-widget visualization config — schemaless on purpose so the front-end
    # can evolve widget options (Query Value precision, Top List sort, Heatmap
    # axis, Change compareTo, Distribution buckets, etc) without coordinated
    # backend changes. Stored verbatim inside the dashboards.widgets JSONB.
    config: dict[str, Any] | None = None
    createdAt: int


class ShareSettingsModel(BaseModel):
    enabled: bool = False
    shareName: str | None = None
    defaultTimeframe: str = "1h"
    allowTimeframeChange: bool = True
    theme: str = "auto"


class ShareConfigModel(BaseModel):
    public: ShareSettingsModel | None = None


class DashboardCreate(BaseModel):
    name: str
    kind: str = "dashboard"
    icon: str | None = None
    description: str | None = None
    widgets: list[WidgetModel] = Field(default_factory=list)
    layout: list[Any] = Field(default_factory=list)
    template_vars: list[Any] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    share: ShareConfigModel | None = None


class DashboardPatch(BaseModel):
    name: str | None = None
    kind: str | None = None
    icon: str | None = None
    description: str | None = None
    widgets: list[WidgetModel] | None = None
    layout: list[Any] | None = None
    template_vars: list[Any] | None = None
    tags: list[str] | None = None
    share: ShareConfigModel | None = None


def _row_to_dict(row) -> dict[str, Any]:
    widgets = row.widgets if isinstance(row.widgets, list) else json.loads(row.widgets or "[]")
    layout = row.layout if isinstance(row.layout, list) else json.loads(row.layout or "[]")
    template_vars = (
        row.template_vars if isinstance(row.template_vars, list)
        else json.loads(row.template_vars or "[]")
    )
    share = row.share if not isinstance(row.share, str) else json.loads(row.share)
    return {
        "id": str(row.id),
        "name": row.name,
        "kind": row.kind,
        "icon": row.icon,
        "description": row.description,
        "layout": layout,
        "widgets": widgets,
        "templateVars": template_vars,
        "tags": list(row.tags or []),
        "share": share,
        "popularity": row.popularity,
        "modifiedMs": int(row.updated_at.timestamp() * 1000),
        "ownerId": row.owner_id,
        "author": {
            "name": row.author_name or "Unknown",
            "avatarColor": "#7c8a5b",
        },
    }


_LIST_QUERY = text(
    """
    SELECT d.id, d.owner_id, d.name, d.kind, d.icon, d.description,
           d.layout, d.widgets, d.template_vars, d.tags, d.share,
           d.popularity, d.created_at, d.updated_at,
           u.name AS author_name
    FROM dashboards d
    LEFT JOIN users u ON u.id = d.owner_id
    """
)


@router.get("")
async def list_dashboards(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " WHERE d.owner_id = :uid ORDER BY d.updated_at DESC"),
        {"uid": user.id},
    )
    return [_row_to_dict(r) for r in res]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    body: DashboardCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO dashboards (
                id, owner_id, name, kind, icon, description, layout, widgets,
                template_vars, tags, share
            ) VALUES (
                :id, :owner, :name, :kind, :icon, :desc,
                CAST(:layout AS jsonb), CAST(:widgets AS jsonb),
                CAST(:tvars AS jsonb), :tags,
                CAST(:share AS jsonb)
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": body.name,
            "kind": body.kind,
            "icon": body.icon,
            "desc": body.description,
            "layout": json.dumps(body.layout),
            "widgets": json.dumps([w.model_dump() for w in body.widgets]),
            "tvars": json.dumps(body.template_vars),
            "tags": body.tags,
            "share": json.dumps(body.share.model_dump()) if body.share else None,
        },
    )
    await db.commit()
    return await get_dashboard(str(new_id), user, db)


@router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " WHERE d.id = :id"),
        {"id": dashboard_id},
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return _row_to_dict(row)


@router.patch("/{dashboard_id}")
async def patch_dashboard(
    dashboard_id: str,
    body: DashboardPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return await get_dashboard(dashboard_id, user, db)

    set_parts: list[str] = []
    params: dict[str, Any] = {"id": dashboard_id, "uid": user.id}
    for key, val in fields.items():
        if key in ("widgets", "layout", "template_vars", "share"):
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
        f"UPDATE dashboards SET {', '.join(set_parts)} "
        f"WHERE id = :id AND owner_id = :uid RETURNING id"
    )
    res = await db.execute(text(sql), params)
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.commit()
    return await get_dashboard(dashboard_id, user, db)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text("DELETE FROM dashboards WHERE id = :id AND owner_id = :uid RETURNING id"),
        {"id": dashboard_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.commit()


@router.post("/{dashboard_id}/widgets", status_code=status.HTTP_201_CREATED)
async def append_widget(
    dashboard_id: str,
    body: WidgetModel,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text(
            """
            UPDATE dashboards
            SET widgets = widgets || CAST(:w AS jsonb),
                updated_at = NOW()
            WHERE id = :id AND owner_id = :uid
            """
        ),
        {"id": dashboard_id, "uid": user.id, "w": json.dumps([body.model_dump()])},
    )
    await db.commit()
    return body.model_dump()


@router.post("/{dashboard_id}/clone", status_code=status.HTTP_201_CREATED)
async def clone_dashboard(
    dashboard_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    src = await get_dashboard(dashboard_id, user, db)
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO dashboards (
                id, owner_id, name, kind, icon, description, layout, widgets,
                template_vars, tags, share
            ) VALUES (
                :id, :owner, :name, :kind, :icon, :desc,
                CAST(:layout AS jsonb), CAST(:widgets AS jsonb),
                CAST(:tvars AS jsonb), :tags, NULL
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": f"{src['name']} (copy)",
            "kind": src["kind"],
            "icon": src["icon"],
            "desc": src.get("description"),
            "layout": json.dumps(src["layout"]),
            "widgets": json.dumps(src["widgets"]),
            "tvars": json.dumps(src.get("templateVars", [])),
            "tags": src["tags"],
        },
    )
    await db.commit()
    return await get_dashboard(str(new_id), user, db)


# Public share — no auth required
public_router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@public_router.get("/{dashboard_id}/public")
async def get_public_dashboard(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " WHERE d.id = :id"),
        {"id": dashboard_id},
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    share = row.share if not isinstance(row.share, str) else json.loads(row.share or "null")
    if not share or not share.get("public", {}).get("enabled"):
        raise HTTPException(status_code=404, detail="Not shared")
    full = _row_to_dict(row)
    # Strip ownerId / author identity from public payload
    full.pop("ownerId", None)
    return full
