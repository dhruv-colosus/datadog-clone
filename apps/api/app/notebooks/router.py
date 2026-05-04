"""Notebooks CRUD."""

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


router = APIRouter(prefix="/notebooks", tags=["notebooks"])


class NotebookCreate(BaseModel):
    name: str | None = None
    type: str = "investigation"
    cells: list[dict[str, Any]] = Field(default_factory=list)
    template_vars: list[Any] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    favorite: bool = False


class NotebookPatch(BaseModel):
    name: str | None = None
    type: str | None = None
    cells: list[dict[str, Any]] | None = None
    template_vars: list[Any] | None = None
    tags: list[str] | None = None
    favorite: bool | None = None


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
        "type": row.type,
        "cells": cells,
        "templateVars": template_vars,
        "tags": list(row.tags or []),
        "favorite": bool(row.favorite),
        "modifiedMs": int(row.updated_at.timestamp() * 1000),
        "createdMs": int(row.created_at.timestamp() * 1000),
        "ownerId": row.owner_id,
        "author": {
            "name": row.author_name or "Unknown",
            "avatarColor": "#7c8a5b",
        },
    }


_LIST_QUERY = text(
    """
    SELECT n.id, n.owner_id, n.name, n.type,
           n.cells, n.template_vars, n.tags, n.favorite,
           n.created_at, n.updated_at,
           u.name AS author_name
    FROM notebooks n
    LEFT JOIN users u ON u.id = n.owner_id
    """
)


def _default_name() -> str:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return f"Untitled Notebook {now.strftime('%b %d %Y %H:%M')}"


@router.get("")
async def list_notebooks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " WHERE n.owner_id = :uid ORDER BY n.updated_at DESC"),
        {"uid": user.id},
    )
    return [_row_to_dict(r) for r in res]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_notebook(
    body: NotebookCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    name = (body.name or "").strip() or _default_name()
    await db.execute(
        text(
            """
            INSERT INTO notebooks (
                id, owner_id, name, type, cells, template_vars, tags, favorite
            ) VALUES (
                :id, :owner, :name, :type,
                CAST(:cells AS jsonb),
                CAST(:tvars AS jsonb),
                :tags, :favorite
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": name,
            "type": body.type,
            "cells": json.dumps(body.cells),
            "tvars": json.dumps(body.template_vars),
            "tags": body.tags,
            "favorite": body.favorite,
        },
    )
    await db.commit()
    return await get_notebook(str(new_id), user, db)


@router.get("/{notebook_id}")
async def get_notebook(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(str(_LIST_QUERY) + " WHERE n.id = :id"),
        {"id": notebook_id},
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return _row_to_dict(row)


@router.patch("/{notebook_id}")
async def patch_notebook(
    notebook_id: str,
    body: NotebookPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return await get_notebook(notebook_id, user, db)

    set_parts: list[str] = []
    params: dict[str, Any] = {"id": notebook_id, "uid": user.id}
    for key, val in fields.items():
        if key in ("cells", "template_vars"):
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
        f"UPDATE notebooks SET {', '.join(set_parts)} "
        f"WHERE id = :id AND owner_id = :uid RETURNING id"
    )
    res = await db.execute(text(sql), params)
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await db.commit()
    return await get_notebook(notebook_id, user, db)


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text("DELETE FROM notebooks WHERE id = :id AND owner_id = :uid RETURNING id"),
        {"id": notebook_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await db.commit()


@router.post("/{notebook_id}/clone", status_code=status.HTTP_201_CREATED)
async def clone_notebook(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    src = await get_notebook(notebook_id, user, db)
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO notebooks (
                id, owner_id, name, type, cells, template_vars, tags, favorite
            ) VALUES (
                :id, :owner, :name, :type,
                CAST(:cells AS jsonb),
                CAST(:tvars AS jsonb),
                :tags, FALSE
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": f"{src['name']} (copy)",
            "type": src["type"],
            "cells": json.dumps(src["cells"]),
            "tvars": json.dumps(src.get("templateVars", [])),
            "tags": src["tags"],
        },
    )
    await db.commit()
    return await get_notebook(str(new_id), user, db)
