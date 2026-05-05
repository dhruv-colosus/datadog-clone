"""Monitors CRUD (no evaluator yet — Phase 7)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.monitors.evaluator import (
    evaluate_anomaly,
    evaluate_forecast,
    evaluate_value,
    fetch_series,
    status_for,
)
from app.monitors.seed import ensure_default_monitors


router = APIRouter(prefix="/monitors", tags=["monitors"])


MuteDuration = Literal["1h", "4h", "12h", "1d", "1w", "forever"]

_MUTE_DURATIONS: dict[str, timedelta | None] = {
    "1h": timedelta(hours=1),
    "4h": timedelta(hours=4),
    "12h": timedelta(hours=12),
    "1d": timedelta(days=1),
    "1w": timedelta(weeks=1),
    "forever": None,
}


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


class MuteRequest(BaseModel):
    duration: MuteDuration = "1h"


class PreviewRequest(BaseModel):
    metric: str
    aggregator: Literal["avg", "sum", "min", "max"] = "avg"
    window_seconds: int = Field(default=300, ge=60, le=86400)
    operator: Literal[">", ">=", "<", "<="] = ">"
    critical: float | None = None
    warning: float | None = None


class AnomalyPreviewRequest(BaseModel):
    metric: str
    window_seconds: int = Field(default=1800, ge=120, le=86400)
    rollup_seconds: int = Field(default=60, ge=10, le=3600)
    deviations: float = Field(default=2.0, ge=0.5, le=5.0)
    direction: Literal["above", "below", "both"] = "both"
    algorithm: Literal["basic", "agile", "robust"] = "basic"


class ForecastPreviewRequest(BaseModel):
    metric: str
    window_seconds: int = Field(default=3600, ge=300, le=604800)
    rollup_seconds: int = Field(default=300, ge=30, le=3600)
    forecast_window_seconds: int = Field(default=3600, ge=300, le=604800)
    threshold: float
    operator: Literal[">", ">=", "<", "<="] = ">"
    algorithm: Literal["linear", "seasonal"] = "linear"


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
    muted = bool(row.muted)
    muted_until_dt = row.muted_until
    # Auto-expire if the mute window has elapsed.
    if muted and muted_until_dt is not None and muted_until_dt <= datetime.now(timezone.utc):
        muted = False
        muted_until_dt = None
    return {
        "id": str(row.id),
        "name": row.name,
        "type": row.type,
        "status": row.status,
        "priority": row.priority,
        "tags": list(row.tags or []),
        "query": query,
        "thresholds": thresholds,
        "message": row.message,
        "recoveryMessage": row.recovery_message,
        "impact": row.impact,
        "runbookSteps": runbook,
        "team": row.team,
        "muted": muted,
        "mutedUntilMs": (
            int(muted_until_dt.timestamp() * 1000) if muted_until_dt is not None else None
        ),
        "createdMs": int(row.created_at.timestamp() * 1000),
    }


_SELECT = (
    "SELECT id, owner_id, name, type, status, query, thresholds, message, "
    "recovery_message, impact, runbook_steps, tags, priority, team, muted, "
    "muted_until, created_at, updated_at FROM monitors"
)


@router.get("")
async def list_monitors(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    await ensure_default_monitors(db, user.id)
    res = await db.execute(
        text(_SELECT + " WHERE owner_id = :uid ORDER BY updated_at DESC"),
        {"uid": user.id},
    )
    return [_row_to_dict(r) for r in res]


@router.post("/preview")
async def preview_monitor(
    body: PreviewRequest,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Live evaluation against the last `window_seconds` of metric_points.

    Used by the configure screen to show "0 Alert / 0 Warn / 0 Recover /
    0 No Data" on the right rail and to keep the threshold preview honest.
    """
    value = await evaluate_value(
        metric=body.metric,
        aggregator=body.aggregator,
        window_seconds=body.window_seconds,
    )
    status_label = status_for(
        value,
        operator=body.operator,
        critical=body.critical,
        warning=body.warning,
    )
    return {
        "value": value,
        "status": status_label,
        "metric": body.metric,
        "windowSeconds": body.window_seconds,
    }


@router.post("/preview/anomaly")
async def preview_anomaly(
    body: AnomalyPreviewRequest,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Returns the time series + computed anomaly band so the configure
    screen can render a preview chart with the gray expected-range band."""
    series = await fetch_series(
        metric=body.metric,
        window_seconds=body.window_seconds,
        step_seconds=body.rollup_seconds,
    )
    status, evidence = evaluate_anomaly(
        series, deviations=body.deviations, direction=body.direction,
    )
    points = [{"ts": int(t * 1000), "value": v} for t, v in series]
    return {
        "metric": body.metric,
        "status": status,
        "points": points,
        "upper": evidence.get("upper"),
        "lower": evidence.get("lower"),
        "mean": evidence.get("mean"),
        "currentValue": evidence.get("value"),
    }


@router.post("/preview/forecast")
async def preview_forecast(
    body: ForecastPreviewRequest,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Returns the time series + projected future trend so the configure
    screen can render a forecast chart with the dashed extrapolation."""
    series = await fetch_series(
        metric=body.metric,
        window_seconds=body.window_seconds,
        step_seconds=body.rollup_seconds,
    )
    status, evidence = evaluate_forecast(
        series,
        forecast_window_seconds=body.forecast_window_seconds,
        threshold=body.threshold,
        operator=body.operator,
    )
    points = [{"ts": int(t * 1000), "value": v} for t, v in series]
    forecast_points: list[dict[str, Any]] = []
    if "slope" in evidence and len(series) >= 2:
        last_t, _ = series[-1]
        slope = float(evidence["slope"])
        intercept = float(series[-1][1] - slope * last_t)
        steps = 30
        step = body.forecast_window_seconds / steps
        for i in range(1, steps + 1):
            t = last_t + step * i
            forecast_points.append({"ts": int(t * 1000), "value": slope * t + intercept})
    return {
        "metric": body.metric,
        "status": status,
        "points": points,
        "forecast": forecast_points,
        "threshold": body.threshold,
        "currentValue": evidence.get("currentValue"),
        "projectedValue": evidence.get("projectedValue"),
    }


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
    body: MuteRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    duration_key = (body.duration if body is not None else "1h")
    delta = _MUTE_DURATIONS.get(duration_key)
    muted_until = (
        datetime.now(timezone.utc) + delta if delta is not None else None
    )
    res = await db.execute(
        text(
            "UPDATE monitors SET muted = TRUE, muted_until = :until, updated_at = NOW() "
            "WHERE id = :id AND owner_id = :uid RETURNING id"
        ),
        {"id": monitor_id, "uid": user.id, "until": muted_until},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    await db.commit()
    return await get_monitor(monitor_id, user, db)


@router.post("/{monitor_id}/unmute")
async def unmute_monitor(
    monitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(
            "UPDATE monitors SET muted = FALSE, muted_until = NULL, updated_at = NOW() "
            "WHERE id = :id AND owner_id = :uid RETURNING id"
        ),
        {"id": monitor_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    await db.commit()
    return await get_monitor(monitor_id, user, db)


@router.post("/{monitor_id}/resolve")
async def resolve_monitor(
    monitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(
            "UPDATE monitors SET status = 'OK', updated_at = NOW() "
            "WHERE id = :id AND owner_id = :uid RETURNING id"
        ),
        {"id": monitor_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    await db.commit()
    return await get_monitor(monitor_id, user, db)
