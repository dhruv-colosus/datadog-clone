"""Incidents — declare, timeline, tasks, postmortems."""

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


router = APIRouter(prefix="/incidents", tags=["incidents"])


SeverityLit = Literal["SEV-1", "SEV-2", "SEV-3", "SEV-4", "SEV-5"]
StatusLit = Literal["active", "stable", "resolved", "completed"]
TimelineKindLit = Literal[
    "state_change", "comment", "integration", "task_added",
    "role_assigned", "severity_change",
]
TaskStatusLit = Literal["open", "in_progress", "done"]


def _incident_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "displayId": row.display_id,
        "title": row.title,
        "severity": row.severity,
        "status": row.status,
        "summary": row.summary,
        "rootCause": row.root_cause,
        "customerImpact": row.customer_impact,
        "detectedVia": row.detected_via,
        "affectedServices": list(row.affected_services or []),
        "commanderUserId": row.commander_user_id,
        "commsUserId": row.comms_user_id,
        "createdBy": row.created_by,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "resolvedMs": (
            int(row.resolved_at.timestamp() * 1000) if row.resolved_at else None
        ),
        "completedMs": (
            int(row.completed_at.timestamp() * 1000) if row.completed_at else None
        ),
        "updatedMs": int(row.updated_at.timestamp() * 1000),
    }


def _timeline_row(row) -> dict[str, Any]:
    payload = (
        row.payload
        if isinstance(row.payload, dict)
        else json.loads(row.payload or "{}")
    )
    return {
        "id": str(row.id),
        "incidentId": str(row.incident_id),
        "kind": row.kind,
        "actorUserId": row.actor_user_id,
        "actorLabel": row.actor_label,
        "payload": payload,
        "occurredMs": int(row.occurred_at.timestamp() * 1000),
    }


def _task_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "incidentId": str(row.incident_id),
        "title": row.title,
        "status": row.status,
        "assigneeUserId": row.assignee_user_id,
        "assigneeLabel": row.assignee_label,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "completedMs": (
            int(row.completed_at.timestamp() * 1000) if row.completed_at else None
        ),
    }


def _postmortem_row(row) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row.id),
        "incidentId": str(row.incident_id),
        "content": row.content,
        "status": row.status,
        "templateUsed": row.template_used,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "updatedMs": int(row.updated_at.timestamp() * 1000),
    }


_INCIDENT_SELECT = (
    "SELECT id, display_id, title, severity, status, summary, root_cause, "
    "customer_impact, detected_via, affected_services, commander_user_id, "
    "comms_user_id, created_by, created_at, resolved_at, completed_at, "
    "updated_at FROM incidents"
)


@router.get("")
async def list_incidents(
    severity: list[str] | None = Query(default=None),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    service: list[str] | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    sql = _INCIDENT_SELECT
    where: list[str] = []
    params: dict[str, Any] = {}
    if severity:
        where.append("severity = ANY(:severities)")
        params["severities"] = severity
    if status_filter:
        where.append("status = ANY(:statuses)")
        params["statuses"] = status_filter
    if service:
        where.append("affected_services && :services")
        params["services"] = service
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit
    res = await db.execute(text(sql), params)
    return [_incident_row(r) for r in res]


@router.get("/{incident_id}")
async def get_incident(
    incident_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    inc_res = await db.execute(
        text(_INCIDENT_SELECT + " WHERE id = :id"), {"id": incident_id}
    )
    inc_row = inc_res.first()
    if inc_row is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident = _incident_row(inc_row)

    tl_res = await db.execute(
        text(
            "SELECT id, incident_id, kind, actor_user_id, actor_label, "
            "payload, occurred_at FROM incident_timeline "
            "WHERE incident_id = :id ORDER BY occurred_at ASC"
        ),
        {"id": incident_id},
    )
    incident["timeline"] = [_timeline_row(r) for r in tl_res]

    task_res = await db.execute(
        text(
            "SELECT id, incident_id, title, status, assignee_user_id, "
            "assignee_label, created_at, completed_at FROM incident_tasks "
            "WHERE incident_id = :id ORDER BY created_at DESC"
        ),
        {"id": incident_id},
    )
    incident["tasks"] = [_task_row(r) for r in task_res]

    pm_res = await db.execute(
        text(
            "SELECT id, incident_id, content, status, template_used, "
            "created_at, updated_at FROM incident_postmortems "
            "WHERE incident_id = :id"
        ),
        {"id": incident_id},
    )
    incident["postmortem"] = _postmortem_row(pm_res.first())
    return incident


class IncidentCreate(BaseModel):
    title: str
    severity: SeverityLit = "SEV-3"
    summary: str | None = None
    customer_impact: str | None = None
    detected_via: str | None = None
    affected_services: list[str] = Field(default_factory=list)
    commander_user_id: int | None = None
    comms_user_id: int | None = None


async def _next_display_id(db: AsyncSession) -> str:
    res = await db.execute(text("SELECT nextval('incident_display_seq')"))
    n = res.scalar()
    return f"INC-{n}"


async def _add_timeline_entry(
    db: AsyncSession,
    *,
    incident_id: str,
    kind: str,
    payload: dict[str, Any],
    actor_user_id: int | None = None,
    actor_label: str | None = None,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO incident_timeline
                (id, incident_id, kind, actor_user_id, actor_label, payload)
            VALUES (:id, :inc, :kind, :uid, :label, CAST(:payload AS jsonb))
            """
        ),
        {
            "id": uuid.uuid4(),
            "inc": incident_id,
            "kind": kind,
            "uid": actor_user_id,
            "label": actor_label,
            "payload": json.dumps(payload),
        },
    )


@router.post("", status_code=201)
async def create_incident(
    body: IncidentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    display_id = await _next_display_id(db)
    await db.execute(
        text(
            """
            INSERT INTO incidents
                (id, display_id, title, severity, summary, customer_impact,
                 detected_via, affected_services, commander_user_id,
                 comms_user_id, created_by)
            VALUES (:id, :did, :title, :sev, :summary, :impact, :detected,
                    :services, :commander, :comms, :uid)
            """
        ),
        {
            "id": new_id,
            "did": display_id,
            "title": body.title,
            "sev": body.severity,
            "summary": body.summary,
            "impact": body.customer_impact,
            "detected": body.detected_via or f"manual:user:{user.id}",
            "services": body.affected_services,
            "commander": body.commander_user_id,
            "comms": body.comms_user_id,
            "uid": user.id,
        },
    )
    await _add_timeline_entry(
        db,
        incident_id=str(new_id),
        kind="state_change",
        payload={"to": "active", "title": body.title, "severity": body.severity},
        actor_user_id=user.id,
        actor_label=user.name or user.email,
    )
    await db.commit()
    return await get_incident(str(new_id), user, db)


@router.post("/from-monitor/{monitor_id}", status_code=201)
async def declare_from_monitor(
    monitor_id: str,
    body: IncidentCreate | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    mon_res = await db.execute(
        text(
            "SELECT id, name, status, query, tags FROM monitors WHERE id = :id"
        ),
        {"id": monitor_id},
    )
    mon = mon_res.first()
    if mon is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    query = (
        mon.query
        if isinstance(mon.query, dict)
        else json.loads(mon.query or "{}")
    )
    metric = query.get("metric", "")
    service = next(
        (
            t.split(":", 1)[1]
            for t in (mon.tags or [])
            if t.startswith("monitor_pack:") and t.split(":", 1)[1] not in {"host"}
        ),
        None,
    ) or (metric.split(".", 1)[0] if metric else "unknown")
    payload = body or IncidentCreate(
        title=mon.name,
        severity="SEV-2" if mon.status == "Alert" else "SEV-3",
        affected_services=[service],
        detected_via=f"monitor:{monitor_id}",
        summary=f"Auto-declared from monitor '{mon.name}' (status={mon.status}).",
    )
    if not payload.affected_services:
        payload.affected_services = [service]
    if not payload.detected_via:
        payload.detected_via = f"monitor:{monitor_id}"
    return await create_incident(payload, user, db)


class IncidentPatch(BaseModel):
    title: str | None = None
    severity: SeverityLit | None = None
    status: StatusLit | None = None
    summary: str | None = None
    root_cause: str | None = None
    customer_impact: str | None = None
    affected_services: list[str] | None = None
    commander_user_id: int | None = None
    comms_user_id: int | None = None


@router.patch("/{incident_id}")
async def patch_incident(
    incident_id: str,
    body: IncidentPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    existing = await db.execute(
        text(_INCIDENT_SELECT + " WHERE id = :id"), {"id": incident_id}
    )
    row = existing.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    sets: list[str] = ["updated_at = NOW()"]
    params: dict[str, Any] = {"id": incident_id}
    timeline_events: list[tuple[str, dict[str, Any]]] = []

    if body.title is not None:
        sets.append("title = :title")
        params["title"] = body.title
    if body.severity is not None and body.severity != row.severity:
        sets.append("severity = :sev")
        params["sev"] = body.severity
        timeline_events.append(
            ("severity_change", {"from": row.severity, "to": body.severity})
        )
    if body.status is not None and body.status != row.status:
        sets.append("status = :status")
        params["status"] = body.status
        if body.status == "resolved":
            sets.append("resolved_at = COALESCE(resolved_at, NOW())")
        if body.status == "completed":
            sets.append("completed_at = COALESCE(completed_at, NOW())")
        timeline_events.append(
            ("state_change", {"from": row.status, "to": body.status})
        )
    if body.summary is not None:
        sets.append("summary = :summary")
        params["summary"] = body.summary
    if body.root_cause is not None:
        sets.append("root_cause = :rc")
        params["rc"] = body.root_cause
    if body.customer_impact is not None:
        sets.append("customer_impact = :ci")
        params["ci"] = body.customer_impact
    if body.affected_services is not None:
        sets.append("affected_services = :services")
        params["services"] = body.affected_services
    if body.commander_user_id is not None and body.commander_user_id != row.commander_user_id:
        sets.append("commander_user_id = :commander")
        params["commander"] = body.commander_user_id
        timeline_events.append(
            ("role_assigned", {"role": "commander", "user_id": body.commander_user_id})
        )
    if body.comms_user_id is not None and body.comms_user_id != row.comms_user_id:
        sets.append("comms_user_id = :comms")
        params["comms"] = body.comms_user_id
        timeline_events.append(
            ("role_assigned", {"role": "comms", "user_id": body.comms_user_id})
        )

    if len(sets) > 1:
        await db.execute(
            text(f"UPDATE incidents SET {', '.join(sets)} WHERE id = :id"),
            params,
        )
    for kind, payload in timeline_events:
        await _add_timeline_entry(
            db,
            incident_id=incident_id,
            kind=kind,
            payload=payload,
            actor_user_id=user.id,
            actor_label=user.name or user.email,
        )
    await db.commit()
    return await get_incident(incident_id, user, db)


class TimelineCreate(BaseModel):
    kind: TimelineKindLit = "comment"
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/{incident_id}/timeline")
async def post_timeline(
    incident_id: str,
    body: TimelineCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _add_timeline_entry(
        db,
        incident_id=incident_id,
        kind=body.kind,
        payload=body.payload,
        actor_user_id=user.id,
        actor_label=user.name or user.email,
    )
    await db.commit()
    return await get_incident(incident_id, user, db)


class TaskCreate(BaseModel):
    title: str
    assignee_user_id: int | None = None
    assignee_label: str | None = None


@router.post("/{incident_id}/tasks", status_code=201)
async def create_task(
    incident_id: str,
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO incident_tasks
                (id, incident_id, title, assignee_user_id, assignee_label)
            VALUES (:id, :inc, :title, :uid, :label)
            """
        ),
        {
            "id": new_id,
            "inc": incident_id,
            "title": body.title,
            "uid": body.assignee_user_id,
            "label": body.assignee_label,
        },
    )
    await _add_timeline_entry(
        db,
        incident_id=incident_id,
        kind="task_added",
        payload={"task_id": str(new_id), "title": body.title},
        actor_user_id=user.id,
        actor_label=user.name or user.email,
    )
    await db.commit()
    return await get_incident(incident_id, user, db)


class TaskPatch(BaseModel):
    status: TaskStatusLit | None = None
    title: str | None = None


@router.patch("/{incident_id}/tasks/{task_id}")
async def patch_task(
    incident_id: str,
    task_id: str,
    body: TaskPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    sets: list[str] = []
    params: dict[str, Any] = {"id": task_id, "inc": incident_id}
    if body.status is not None:
        sets.append("status = :status")
        params["status"] = body.status
        if body.status == "done":
            sets.append("completed_at = COALESCE(completed_at, NOW())")
    if body.title is not None:
        sets.append("title = :title")
        params["title"] = body.title
    if sets:
        await db.execute(
            text(
                f"UPDATE incident_tasks SET {', '.join(sets)} "
                "WHERE id = :id AND incident_id = :inc"
            ),
            params,
        )
        await db.commit()
    return await get_incident(incident_id, user, db)


class PostmortemUpsert(BaseModel):
    content: str
    status: Literal["draft", "published"] = "draft"
    template_used: str = "five-whys"


@router.put("/{incident_id}/postmortem")
async def upsert_postmortem(
    incident_id: str,
    body: PostmortemUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text(
            """
            INSERT INTO incident_postmortems
                (id, incident_id, content, status, template_used)
            VALUES (gen_random_uuid(), :inc, :content, :status, :tpl)
            ON CONFLICT (incident_id) DO UPDATE
                SET content = EXCLUDED.content,
                    status = EXCLUDED.status,
                    template_used = EXCLUDED.template_used,
                    updated_at = NOW()
            """
        ),
        {
            "inc": incident_id,
            "content": body.content,
            "status": body.status,
            "tpl": body.template_used,
        },
    )
    await db.commit()
    return await get_incident(incident_id, user, db)
