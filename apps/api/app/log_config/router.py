"""Logs configuration — pipelines, facets, scrubbers."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.log_config.processors import apply_processors
from app.log_config.runtime import refresh_caches
from app.log_config.scrubber import LIBRARY_PATTERNS, scrub_log


pipelines_router = APIRouter(prefix="/logs/pipelines", tags=["log-pipelines"])
facets_router = APIRouter(prefix="/logs/facets", tags=["log-facets"])
scrubber_router = APIRouter(prefix="/security/data-security", tags=["data-security"])


# ---------------- pipelines ----------------


def _pipeline_row(row) -> dict[str, Any]:
    procs = (
        row.processors
        if isinstance(row.processors, list)
        else json.loads(row.processors or "[]")
    )
    return {
        "id": str(row.id),
        "name": row.name,
        "filterQuery": row.filter_query,
        "processors": procs,
        "isNested": row.is_nested,
        "parentPipelineId": (
            str(row.parent_pipeline_id) if row.parent_pipeline_id else None
        ),
        "enabled": row.enabled,
        "orderIndex": row.order_index,
        "isIntegration": row.is_integration,
        "integrationName": row.integration_name,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "updatedMs": int(row.updated_at.timestamp() * 1000),
    }


_PIPELINE_SELECT = (
    "SELECT id, name, filter_query, processors, is_nested, parent_pipeline_id, "
    "enabled, order_index, is_integration, integration_name, modified_by, "
    "created_at, updated_at FROM log_pipelines"
)


@pipelines_router.get("")
async def list_pipelines(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(_PIPELINE_SELECT + " ORDER BY order_index ASC, created_at ASC")
    )
    return [_pipeline_row(r) for r in res]


@pipelines_router.get("/library")
async def list_library_pipelines() -> list[dict[str, Any]]:
    return [
        {
            "name": "NGINX access logs",
            "integration": "nginx",
            "description": "Parses NGINX access logs into structured fields (status, method, path, duration).",
        },
        {
            "name": "Apache access logs",
            "integration": "apache",
            "description": "Parses Apache combined log format.",
        },
        {
            "name": "AWS Lambda logs",
            "integration": "aws_lambda",
            "description": "Parses Lambda START/END/REPORT lines and extracts duration + memory.",
        },
        {
            "name": "Postgres query logs",
            "integration": "postgresql",
            "description": "Extracts SQL statement, duration, and client IP from Postgres logs.",
        },
        {
            "name": "Redis slowlog",
            "integration": "redis",
            "description": "Parses redis-cli SLOWLOG entries.",
        },
        {
            "name": "Application JSON",
            "integration": "json",
            "description": "Parses standard structured JSON application logs.",
        },
    ]


@pipelines_router.get("/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_PIPELINE_SELECT + " WHERE id = :id"), {"id": pipeline_id}
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return _pipeline_row(row)


class PipelineCreate(BaseModel):
    name: str
    filter_query: str = ""
    processors: list[dict[str, Any]] = Field(default_factory=list)
    is_nested: bool = False
    parent_pipeline_id: str | None = None
    enabled: bool = True
    order_index: int = 0


@pipelines_router.post("", status_code=201)
async def create_pipeline(
    body: PipelineCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO log_pipelines
                (id, name, filter_query, processors, is_nested, parent_pipeline_id,
                 enabled, order_index, modified_by)
            VALUES (:id, :name, :filter, CAST(:procs AS jsonb), :nested, :parent,
                    :enabled, :order, :uid)
            """
        ),
        {
            "id": new_id,
            "name": body.name,
            "filter": body.filter_query,
            "procs": json.dumps(body.processors),
            "nested": body.is_nested,
            "parent": body.parent_pipeline_id,
            "enabled": body.enabled,
            "order": body.order_index,
            "uid": user.id,
        },
    )
    await db.commit()
    await refresh_caches()
    return await get_pipeline(str(new_id), user, db)


class PipelinePatch(BaseModel):
    name: str | None = None
    filter_query: str | None = None
    processors: list[dict[str, Any]] | None = None
    enabled: bool | None = None
    order_index: int | None = None


@pipelines_router.put("/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    body: PipelinePatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sets: list[str] = ["updated_at = NOW()", "modified_by = :uid"]
    params: dict[str, Any] = {"id": pipeline_id, "uid": user.id}
    if body.name is not None:
        sets.append("name = :name")
        params["name"] = body.name
    if body.filter_query is not None:
        sets.append("filter_query = :filter")
        params["filter"] = body.filter_query
    if body.processors is not None:
        sets.append("processors = CAST(:procs AS jsonb)")
        params["procs"] = json.dumps(body.processors)
    if body.enabled is not None:
        sets.append("enabled = :enabled")
        params["enabled"] = body.enabled
    if body.order_index is not None:
        sets.append("order_index = :order")
        params["order"] = body.order_index
    await db.execute(
        text(f"UPDATE log_pipelines SET {', '.join(sets)} WHERE id = :id"),
        params,
    )
    await db.commit()
    await refresh_caches()
    return await get_pipeline(pipeline_id, user, db)


@pipelines_router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(
    pipeline_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        text("DELETE FROM log_pipelines WHERE id = :id"), {"id": pipeline_id}
    )
    await db.commit()
    await refresh_caches()


class ReorderPayload(BaseModel):
    ids: list[str]


@pipelines_router.post("/reorder")
async def reorder_pipelines(
    body: ReorderPayload,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    for i, pid in enumerate(body.ids):
        await db.execute(
            text(
                "UPDATE log_pipelines SET order_index = :i, updated_at = NOW() "
                "WHERE id = :id"
            ),
            {"i": i, "id": pid},
        )
    await db.commit()
    await refresh_caches()
    return {"ok": True, "count": len(body.ids)}


class PipelineTestRequest(BaseModel):
    sample: dict[str, Any]


@pipelines_router.post("/{pipeline_id}/test")
async def test_pipeline(
    pipeline_id: str,
    body: PipelineTestRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_PIPELINE_SELECT + " WHERE id = :id"), {"id": pipeline_id}
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline = _pipeline_row(row)
    out = apply_processors(body.sample, pipeline["processors"])
    return {"input": body.sample, "output": out}


# ---------------- facets ----------------


def _facet_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "path": row.path,
        "displayName": row.display_name,
        "facetKind": row.facet_kind,
        "dataType": row.data_type,
        "groupName": row.group_name,
        "hidden": row.hidden,
    }


@facets_router.get("")
async def list_facets(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(
            "SELECT id, path, display_name, facet_kind, data_type, "
            "group_name, hidden FROM log_facets ORDER BY group_name, display_name"
        )
    )
    return [_facet_row(r) for r in res]


class FacetCreate(BaseModel):
    path: str
    display_name: str
    facet_kind: Literal["qualitative", "quantitative"] = "qualitative"
    data_type: Literal["string", "integer", "double", "boolean"] = "string"
    group_name: str = "General"


@facets_router.post("", status_code=201)
async def create_facet(
    body: FacetCreate,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO log_facets
                (id, path, display_name, facet_kind, data_type, group_name)
            VALUES (:id, :path, :name, :kind, :dtype, :group)
            """
        ),
        {
            "id": new_id,
            "path": body.path,
            "name": body.display_name,
            "kind": body.facet_kind,
            "dtype": body.data_type,
            "group": body.group_name,
        },
    )
    await db.commit()
    res = await db.execute(
        text(
            "SELECT id, path, display_name, facet_kind, data_type, "
            "group_name, hidden FROM log_facets WHERE id = :id"
        ),
        {"id": new_id},
    )
    return _facet_row(res.first())


class FacetPatch(BaseModel):
    hidden: bool | None = None
    display_name: str | None = None


@facets_router.patch("/{facet_id}")
async def patch_facet(
    facet_id: str,
    body: FacetPatch,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sets: list[str] = []
    params: dict[str, Any] = {"id": facet_id}
    if body.hidden is not None:
        sets.append("hidden = :hidden")
        params["hidden"] = body.hidden
    if body.display_name is not None:
        sets.append("display_name = :name")
        params["name"] = body.display_name
    if sets:
        await db.execute(
            text(f"UPDATE log_facets SET {', '.join(sets)} WHERE id = :id"),
            params,
        )
        await db.commit()
    res = await db.execute(
        text(
            "SELECT id, path, display_name, facet_kind, data_type, "
            "group_name, hidden FROM log_facets WHERE id = :id"
        ),
        {"id": facet_id},
    )
    return _facet_row(res.first())


# ---------------- scrubbers ----------------


def _scrubber_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "name": row.name,
        "description": row.description,
        "patternKind": row.pattern_kind,
        "libraryPatternId": row.library_pattern_id,
        "customRegex": row.custom_regex,
        "replacementStrategy": row.replacement_strategy,
        "scopeNamespaces": list(row.scope_namespaces or []),
        "enabled": row.enabled,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "updatedMs": int(row.updated_at.timestamp() * 1000),
    }


@scrubber_router.get("/library")
async def get_library_patterns() -> dict[str, Any]:
    return {
        "patterns": [
            {"id": k, "label": v["label"], "regex": v["regex"]}
            for k, v in LIBRARY_PATTERNS.items()
        ],
    }


@scrubber_router.get("/rules")
async def list_scrubber_rules(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(
            "SELECT id, name, description, pattern_kind, library_pattern_id, "
            "custom_regex, replacement_strategy, scope_namespaces, enabled, "
            "created_at, updated_at FROM scrubber_rules ORDER BY name"
        )
    )
    return [_scrubber_row(r) for r in res]


class ScrubberRuleCreate(BaseModel):
    name: str
    description: str | None = None
    pattern_kind: Literal["library", "custom"] = "library"
    library_pattern_id: str | None = None
    custom_regex: str | None = None
    replacement_strategy: Literal["redact", "hash", "partial_redact"] = "redact"
    scope_namespaces: list[str] = Field(default_factory=list)
    enabled: bool = True


@scrubber_router.post("/rules", status_code=201)
async def create_scrubber_rule(
    body: ScrubberRuleCreate,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO scrubber_rules
                (id, name, description, pattern_kind, library_pattern_id,
                 custom_regex, replacement_strategy, scope_namespaces, enabled)
            VALUES (:id, :name, :desc, :pk, :lib, :rx, :strategy, :scope, :enabled)
            """
        ),
        {
            "id": new_id,
            "name": body.name,
            "desc": body.description,
            "pk": body.pattern_kind,
            "lib": body.library_pattern_id,
            "rx": body.custom_regex,
            "strategy": body.replacement_strategy,
            "scope": body.scope_namespaces,
            "enabled": body.enabled,
        },
    )
    await db.commit()
    await refresh_caches()
    res = await db.execute(
        text(
            "SELECT id, name, description, pattern_kind, library_pattern_id, "
            "custom_regex, replacement_strategy, scope_namespaces, enabled, "
            "created_at, updated_at FROM scrubber_rules WHERE id = :id"
        ),
        {"id": new_id},
    )
    return _scrubber_row(res.first())


class ScrubberRulePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    replacement_strategy: Literal["redact", "hash", "partial_redact"] | None = None
    scope_namespaces: list[str] | None = None


@scrubber_router.patch("/rules/{rule_id}")
async def patch_scrubber_rule(
    rule_id: str,
    body: ScrubberRulePatch,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sets: list[str] = ["updated_at = NOW()"]
    params: dict[str, Any] = {"id": rule_id}
    for f in ("name", "description", "enabled"):
        v = getattr(body, f)
        if v is not None:
            sets.append(f"{f} = :{f}")
            params[f] = v
    if body.replacement_strategy is not None:
        sets.append("replacement_strategy = :strategy")
        params["strategy"] = body.replacement_strategy
    if body.scope_namespaces is not None:
        sets.append("scope_namespaces = :scope")
        params["scope"] = body.scope_namespaces
    await db.execute(
        text(f"UPDATE scrubber_rules SET {', '.join(sets)} WHERE id = :id"),
        params,
    )
    await db.commit()
    await refresh_caches()
    res = await db.execute(
        text(
            "SELECT id, name, description, pattern_kind, library_pattern_id, "
            "custom_regex, replacement_strategy, scope_namespaces, enabled, "
            "created_at, updated_at FROM scrubber_rules WHERE id = :id"
        ),
        {"id": rule_id},
    )
    return _scrubber_row(res.first())


@scrubber_router.delete("/rules/{rule_id}", status_code=204)
async def delete_scrubber_rule(
    rule_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        text("DELETE FROM scrubber_rules WHERE id = :id"), {"id": rule_id}
    )
    await db.commit()
    await refresh_caches()


@scrubber_router.get("/findings")
async def list_findings(
    rule_id: str | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=200, ge=1, le=500),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    sql = (
        "SELECT id, rule_id, occurred_at, log_id, service, "
        "excerpt_redacted, pattern_matched FROM scrubber_findings "
        "WHERE occurred_at >= :cutoff"
    )
    params: dict[str, Any] = {"cutoff": cutoff, "limit": limit}
    if rule_id:
        sql += " AND rule_id = :rid"
        params["rid"] = rule_id
    sql += " ORDER BY occurred_at DESC LIMIT :limit"
    res = await db.execute(text(sql), params)
    return [
        {
            "id": str(r.id),
            "ruleId": str(r.rule_id),
            "occurredMs": int(r.occurred_at.timestamp() * 1000),
            "logId": r.log_id,
            "service": r.service,
            "excerptRedacted": r.excerpt_redacted,
            "patternMatched": r.pattern_matched,
        }
        for r in res
    ]
