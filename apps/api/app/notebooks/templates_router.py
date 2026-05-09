"""Notebook templates: custom (user-saved) + featured (built-in)."""

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


router = APIRouter(prefix="/notebook-templates", tags=["notebook-templates"])


class TemplateCreate(BaseModel):
    name: str | None = None
    cells: list[dict[str, Any]] = Field(default_factory=list)
    template_vars: list[Any] = Field(default_factory=list)


class TemplatePatch(BaseModel):
    name: str | None = None
    cells: list[dict[str, Any]] | None = None
    template_vars: list[Any] | None = None


def _row_to_dict(row) -> dict[str, Any]:
    cells = row.cells if isinstance(row.cells, list) else json.loads(row.cells or "[]")
    template_vars = (
        row.template_vars
        if isinstance(row.template_vars, list)
        else json.loads(row.template_vars or "[]")
    )
    return {
        "id": str(row.id),
        "name": row.name,
        "cells": cells,
        "templateVars": template_vars,
        "modifiedMs": int(row.updated_at.timestamp() * 1000),
        "createdMs": int(row.created_at.timestamp() * 1000),
        "ownerId": row.owner_id,
        "author": {
            "name": row.author_name or "Unknown",
            "avatarColor": "#7c8a5b",
        },
        "kind": "custom",
    }


_LIST_QUERY = text(
    """
    SELECT t.id, t.owner_id, t.name,
           t.cells, t.template_vars,
           t.created_at, t.updated_at,
           u.name AS author_name
    FROM notebook_templates t
    LEFT JOIN users u ON u.id = t.owner_id
    """
)


def _default_name(user: User) -> str:
    from datetime import datetime, timezone

    first = (user.name or "").strip().split(" ")[0] or "Template"
    now = datetime.now(timezone.utc)
    return f"{first} {now.strftime('%b %d %Y %H:%M')}"


@router.get("")
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " ORDER BY t.updated_at DESC"),
    )
    return [_row_to_dict(r) for r in res]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    name = (body.name or "").strip() or _default_name(user)
    await db.execute(
        text(
            """
            INSERT INTO notebook_templates (
                id, owner_id, name, cells, template_vars
            ) VALUES (
                :id, :owner, :name,
                CAST(:cells AS jsonb),
                CAST(:tvars AS jsonb)
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": name,
            "cells": json.dumps(body.cells),
            "tvars": json.dumps(body.template_vars),
        },
    )
    await db.commit()
    return await get_template(str(new_id), user, db)


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " WHERE t.id = :id"),
        {"id": template_id},
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return _row_to_dict(row)


@router.patch("/{template_id}")
async def patch_template(
    template_id: str,
    body: TemplatePatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return await get_template(template_id, user, db)

    set_parts: list[str] = []
    params: dict[str, Any] = {"id": template_id, "uid": user.id}
    for key, val in fields.items():
        if key in ("cells", "template_vars"):
            params[key] = json.dumps(val) if val is not None else None
            set_parts.append(f"{key} = CAST(:{key} AS jsonb)")
        else:
            params[key] = val
            set_parts.append(f"{key} = :{key}")
    set_parts.append("updated_at = NOW()")
    sql = (
        f"UPDATE notebook_templates SET {', '.join(set_parts)} "
        f"WHERE id = :id AND owner_id = :uid RETURNING id"
    )
    res = await db.execute(text(sql), params)
    if res.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Template not found or not owned by you",
        )
    await db.commit()
    return await get_template(template_id, user, db)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text(
            "DELETE FROM notebook_templates "
            "WHERE id = :id AND owner_id = :uid RETURNING id"
        ),
        {"id": template_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.commit()


@router.post(
    "/{template_id}/instantiate",
    status_code=status.HTTP_201_CREATED,
)
async def instantiate_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new notebook from this template's cells."""
    template = await get_template(template_id, user, db)
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO notebooks (
                id, owner_id, name, type, cells, template_vars, tags, favorite
            ) VALUES (
                :id, :owner, :name, 'investigation',
                CAST(:cells AS jsonb),
                CAST(:tvars AS jsonb),
                '{}', FALSE
            )
            RETURNING id
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": template["name"],
            "cells": json.dumps(template["cells"]),
            "tvars": json.dumps(template.get("templateVars", [])),
        },
    )
    await db.commit()
    return {"id": str(new_id), "name": template["name"]}
