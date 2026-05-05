"""Security — detection rules + signals queue."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.telemetry.pool import get_pool


router = APIRouter(prefix="/security", tags=["security"])

SeverityLit = Literal["critical", "high", "medium", "low", "info"]
SignalStatusLit = Literal["open", "under_review", "archived"]
ArchiveReasonLit = Literal["tp_malicious", "tp_benign", "fp_other"]
RuleTypeLit = Literal["log_signature", "threshold", "new_term", "anomaly"]
SourceLit = Literal["logs", "spans", "audit"]


def _rule_row(row) -> dict[str, Any]:
    cases = (
        row.cases
        if isinstance(row.cases, list)
        else json.loads(row.cases or "[]")
    )
    return {
        "id": str(row.id),
        "name": row.name,
        "description": row.description,
        "ruleType": row.rule_type,
        "source": row.source,
        "query": row.query,
        "cases": cases,
        "severityDefault": row.severity_default,
        "enabled": row.enabled,
        "tags": list(row.tags or []),
        "mitreTactics": list(row.mitre_tactics or []),
        "createdMs": int(row.created_at.timestamp() * 1000),
        "updatedMs": int(row.updated_at.timestamp() * 1000),
    }


def _signal_row(row) -> dict[str, Any]:
    evidence = (
        row.evidence
        if isinstance(row.evidence, dict)
        else json.loads(row.evidence or "{}")
    )
    src = (
        row.source_event_ids
        if isinstance(row.source_event_ids, list)
        else json.loads(row.source_event_ids or "[]")
    )
    return {
        "id": str(row.id),
        "ruleId": str(row.rule_id),
        "title": row.title,
        "severity": row.severity,
        "status": row.status,
        "archiveReason": row.archive_reason,
        "affectedService": row.affected_service,
        "affectedHost": row.affected_host,
        "affectedUser": row.affected_user,
        "sourceEventIds": src,
        "evidence": evidence,
        "mitreTactics": list(row.mitre_tactics or []),
        "createdMs": int(row.created_at.timestamp() * 1000),
        "triagedMs": (
            int(row.triaged_at.timestamp() * 1000) if row.triaged_at else None
        ),
    }


_RULE_SELECT = (
    "SELECT id, name, description, rule_type, source, query, cases, "
    "severity_default, enabled, tags, mitre_tactics, created_at, "
    "updated_at, created_by FROM detection_rules"
)

_SIGNAL_SELECT = (
    "SELECT id, rule_id, title, severity, status, archive_reason, "
    "affected_service, affected_host, affected_user, source_event_ids, "
    "evidence, mitre_tactics, created_at, triaged_at, triaged_by "
    "FROM security_signals"
)


# ---------------- detection rules ----------------


@router.get("/rules")
async def list_rules(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(text(_RULE_SELECT + " ORDER BY name ASC"))
    return [_rule_row(r) for r in res]


@router.get("/rules/{rule_id}")
async def get_rule(
    rule_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_RULE_SELECT + " WHERE id = :id"), {"id": rule_id}
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _rule_row(row)


class RuleCase(BaseModel):
    name: str
    condition: str
    severity: SeverityLit


class RuleCreate(BaseModel):
    name: str
    description: str | None = None
    rule_type: RuleTypeLit = "log_signature"
    source: SourceLit = "logs"
    query: str = ""
    cases: list[RuleCase] = Field(default_factory=list)
    severity_default: SeverityLit = "medium"
    enabled: bool = True
    tags: list[str] = Field(default_factory=list)
    mitre_tactics: list[str] = Field(default_factory=list)


@router.post("/rules", status_code=201)
async def create_rule(
    body: RuleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO detection_rules
                (id, name, description, rule_type, source, query, cases,
                 severity_default, enabled, tags, mitre_tactics, created_by)
            VALUES (:id, :name, :desc, :type, :source, :query, CAST(:cases AS jsonb),
                    :sev, :enabled, :tags, :mitre, :uid)
            """
        ),
        {
            "id": new_id,
            "name": body.name,
            "desc": body.description,
            "type": body.rule_type,
            "source": body.source,
            "query": body.query,
            "cases": json.dumps([c.model_dump() for c in body.cases]),
            "sev": body.severity_default,
            "enabled": body.enabled,
            "tags": body.tags,
            "mitre": body.mitre_tactics,
            "uid": user.id,
        },
    )
    await db.commit()
    return await get_rule(str(new_id), user, db)


class RulePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    rule_type: RuleTypeLit | None = None
    source: SourceLit | None = None
    query: str | None = None
    cases: list[RuleCase] | None = None
    severity_default: SeverityLit | None = None
    enabled: bool | None = None
    tags: list[str] | None = None
    mitre_tactics: list[str] | None = None


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: str,
    body: RulePatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sets: list[str] = ["updated_at = NOW()"]
    params: dict[str, Any] = {"id": rule_id}
    for field in ("name", "description", "query", "enabled"):
        v = getattr(body, field)
        if v is not None:
            sets.append(f"{field} = :{field}")
            params[field] = v
    if body.rule_type is not None:
        sets.append("rule_type = :rule_type")
        params["rule_type"] = body.rule_type
    if body.source is not None:
        sets.append("source = :source")
        params["source"] = body.source
    if body.cases is not None:
        sets.append("cases = CAST(:cases AS jsonb)")
        params["cases"] = json.dumps([c.model_dump() for c in body.cases])
    if body.severity_default is not None:
        sets.append("severity_default = :sev")
        params["sev"] = body.severity_default
    if body.tags is not None:
        sets.append("tags = :tags")
        params["tags"] = body.tags
    if body.mitre_tactics is not None:
        sets.append("mitre_tactics = :mitre")
        params["mitre"] = body.mitre_tactics
    await db.execute(
        text(f"UPDATE detection_rules SET {', '.join(sets)} WHERE id = :id"),
        params,
    )
    await db.commit()
    return await get_rule(rule_id, user, db)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        text("DELETE FROM detection_rules WHERE id = :id"),
        {"id": rule_id},
    )
    await db.commit()


@router.post("/rules/{rule_id}/preview")
async def preview_rule(
    rule_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Dry-run a rule against the last hour of logs/spans."""
    rule_res = await db.execute(
        text(_RULE_SELECT + " WHERE id = :id"), {"id": rule_id}
    )
    rule_row = rule_res.first()
    if rule_row is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule = _rule_row(rule_row)

    pool = await get_pool()
    matches: list[dict[str, Any]] = []
    async with pool.acquire() as conn:
        if rule["source"] == "logs":
            sql = (
                "SELECT ts, service, host, message FROM log_lines "
                "WHERE ts >= NOW() - INTERVAL '1 hour' "
                "AND message ILIKE $1 ORDER BY ts DESC LIMIT 25"
            )
            like = f"%{rule['query']}%" if rule["query"] else "%"
            rows = await conn.fetch(sql, like)
            for r in rows:
                matches.append({
                    "ts": int(r["ts"].timestamp() * 1000),
                    "service": r["service"],
                    "host": r["host"],
                    "message": r["message"][:200],
                })
        elif rule["source"] == "spans":
            sql = (
                "SELECT ts, service, operation, resource, status FROM spans "
                "WHERE ts >= NOW() - INTERVAL '1 hour' "
                "AND status = 1 ORDER BY ts DESC LIMIT 25"
            )
            rows = await conn.fetch(sql)
            for r in rows:
                matches.append({
                    "ts": int(r["ts"].timestamp() * 1000),
                    "service": r["service"],
                    "operation": r["operation"],
                    "resource": r["resource"],
                })
    return {"rule": rule, "matches": matches, "matchCount": len(matches)}


# ---------------- signals ----------------


@router.get("/signals")
async def list_signals(
    severity: list[str] | None = Query(default=None),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    service: list[str] | None = Query(default=None),
    rule_id: list[str] | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    sql = _SIGNAL_SELECT
    where: list[str] = []
    params: dict[str, Any] = {}
    if severity:
        where.append("severity = ANY(:severities)")
        params["severities"] = severity
    if status_filter:
        where.append("status = ANY(:statuses)")
        params["statuses"] = status_filter
    if service:
        where.append("affected_service = ANY(:services)")
        params["services"] = service
    if rule_id:
        where.append("rule_id::text = ANY(:rules)")
        params["rules"] = rule_id
    if where:
        sql += " WHERE " + " AND ".join(where)
    # Order: severity rank desc, then time desc.
    sql += (
        " ORDER BY CASE severity "
        "WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 "
        "WHEN 'low' THEN 1 ELSE 0 END DESC, created_at DESC LIMIT :limit"
    )
    params["limit"] = limit
    res = await db.execute(text(sql), params)
    return [_signal_row(r) for r in res]


@router.get("/signals/{signal_id}")
async def get_signal(
    signal_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_SIGNAL_SELECT + " WHERE id = :id"), {"id": signal_id}
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    return _signal_row(row)


class SignalPatch(BaseModel):
    status: SignalStatusLit | None = None
    archive_reason: ArchiveReasonLit | None = None


@router.patch("/signals/{signal_id}")
async def patch_signal(
    signal_id: str,
    body: SignalPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sets: list[str] = []
    params: dict[str, Any] = {"id": signal_id}
    if body.status is not None:
        sets.append("status = :status")
        params["status"] = body.status
        sets.append("triaged_at = NOW()")
        sets.append("triaged_by = :uid")
        params["uid"] = user.id
    if body.archive_reason is not None:
        sets.append("archive_reason = :reason")
        params["reason"] = body.archive_reason
    if sets:
        await db.execute(
            text(
                f"UPDATE security_signals SET {', '.join(sets)} WHERE id = :id"
            ),
            params,
        )
        await db.commit()
    return await get_signal(signal_id, user, db)
