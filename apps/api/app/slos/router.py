"""SLOs CRUD + status evaluation."""

from __future__ import annotations

import datetime as dt
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
from app.slos.evaluator import burndown_series, evaluate_slo


router = APIRouter(prefix="/slos", tags=["slos"])


SLO_TYPES = {"metric", "monitor", "time_slice"}


class SLOCreate(BaseModel):
    name: str
    description: str | None = None
    type: str = "metric"
    source: dict[str, Any] = Field(default_factory=dict)
    target_pct: float = 99.9
    warning_pct: float | None = None
    time_window_days: int = 7
    services: list[str] = Field(default_factory=list)
    teams: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    favorite: bool = False


class SLOPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None
    source: dict[str, Any] | None = None
    target_pct: float | None = None
    warning_pct: float | None = None
    time_window_days: int | None = None
    services: list[str] | None = None
    teams: list[str] | None = None
    tags: list[str] | None = None
    favorite: bool | None = None


class BurnRateAlertCreate(BaseModel):
    name: str
    short_window_min: int
    long_window_min: int
    burn_threshold: float
    severity: str = "warn"
    enabled: bool = True


_SELECT = (
    "SELECT id, owner_id, name, description, type, source, target_pct, "
    "warning_pct, time_window_days, services, teams, tags, favorite, "
    "created_at, updated_at FROM slos"
)


def _row_to_dict(row, *, owner_name: str | None = None) -> dict[str, Any]:
    src = row.source if isinstance(row.source, dict) else json.loads(row.source or "{}")
    return {
        "id": str(row.id),
        "name": row.name,
        "description": row.description,
        "type": row.type,
        "source": src,
        "targetPct": float(row.target_pct),
        "warningPct": float(row.warning_pct) if row.warning_pct is not None else None,
        "timeWindowDays": int(row.time_window_days),
        "services": list(row.services or []),
        "teams": list(row.teams or []),
        "tags": list(row.tags or []),
        "favorite": bool(row.favorite),
        "ownerId": row.owner_id,
        "ownerName": owner_name,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "modifiedMs": int(row.updated_at.timestamp() * 1000),
    }


def _window_bounds(time_window_days: int) -> tuple[int, int]:
    now = dt.datetime.now(dt.timezone.utc)
    to_ms = int(now.timestamp() * 1000)
    from_ms = int((now - dt.timedelta(days=time_window_days)).timestamp() * 1000)
    return from_ms, to_ms


async def _evaluate_for_row(row) -> dict[str, Any]:
    src = row.source if isinstance(row.source, dict) else json.loads(row.source or "{}")
    from_ms, to_ms = _window_bounds(int(row.time_window_days))
    return await evaluate_slo(
        slo_type=row.type,
        source=src,
        target_pct=float(row.target_pct),
        warning_pct=float(row.warning_pct) if row.warning_pct is not None else None,
        from_ms=from_ms,
        to_ms=to_ms,
    )


@router.get("")
async def list_slos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(_SELECT + " WHERE owner_id = :uid ORDER BY updated_at DESC"),
        {"uid": user.id},
    )
    rows = list(res)
    out: list[dict[str, Any]] = []
    for row in rows:
        d = _row_to_dict(row, owner_name=user.name)
        try:
            d["evaluation"] = await _evaluate_for_row(row)
        except Exception as exc:  # noqa: BLE001
            d["evaluation"] = {
                "status": "no_data",
                "sliPct": None,
                "good": 0,
                "total": 0,
                "bad": 0,
                "errorBudgetRemainingPct": None,
                "error": str(exc),
            }
        out.append(d)
    return out


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_slo(
    body: SLOCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if body.type not in SLO_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type: {body.type}")
    if not (0 < body.target_pct <= 100):
        raise HTTPException(status_code=400, detail="target_pct must be in (0, 100]")
    if body.warning_pct is not None and not (0 < body.warning_pct <= 100):
        raise HTTPException(status_code=400, detail="warning_pct must be in (0, 100]")
    if body.time_window_days <= 0:
        raise HTTPException(status_code=400, detail="time_window_days must be positive")

    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO slos (
                id, owner_id, name, description, type, source,
                target_pct, warning_pct, time_window_days,
                services, teams, tags, favorite
            ) VALUES (
                :id, :owner, :name, :description, :type,
                CAST(:source AS jsonb),
                :target, :warning, :window,
                :services, :teams, :tags, :favorite
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": body.name,
            "description": body.description,
            "type": body.type,
            "source": json.dumps(body.source),
            "target": body.target_pct,
            "warning": body.warning_pct,
            "window": body.time_window_days,
            "services": body.services,
            "teams": body.teams,
            "tags": body.tags,
            "favorite": body.favorite,
        },
    )
    await db.commit()
    return await get_slo(str(new_id), user, db)


@router.get("/{slo_id}")
async def get_slo(
    slo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(text(_SELECT + " WHERE id = :id"), {"id": slo_id})
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="SLO not found")
    d = _row_to_dict(row, owner_name=user.name)
    try:
        d["evaluation"] = await _evaluate_for_row(row)
    except Exception as exc:  # noqa: BLE001
        d["evaluation"] = {
            "status": "no_data",
            "sliPct": None,
            "good": 0,
            "total": 0,
            "bad": 0,
            "errorBudgetRemainingPct": None,
            "error": str(exc),
        }
    return d


@router.patch("/{slo_id}")
async def patch_slo(
    slo_id: str,
    body: SLOPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return await get_slo(slo_id, user, db)
    if "type" in fields and fields["type"] not in SLO_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type: {fields['type']}")
    if "target_pct" in fields and fields["target_pct"] is not None:
        if not (0 < fields["target_pct"] <= 100):
            raise HTTPException(status_code=400, detail="target_pct must be in (0, 100]")

    set_parts: list[str] = []
    params: dict[str, Any] = {"id": slo_id, "uid": user.id}
    for key, val in fields.items():
        if key == "source":
            params["source"] = json.dumps(val) if val is not None else None
            set_parts.append("source = CAST(:source AS jsonb)")
        elif key in ("services", "teams", "tags"):
            params[key] = list(val or [])
            set_parts.append(f"{key} = :{key}")
        else:
            params[key] = val
            set_parts.append(f"{key} = :{key}")
    set_parts.append("updated_at = NOW()")
    sql = (
        f"UPDATE slos SET {', '.join(set_parts)} "
        f"WHERE id = :id AND owner_id = :uid RETURNING id"
    )
    res = await db.execute(text(sql), params)
    if res.first() is None:
        raise HTTPException(status_code=404, detail="SLO not found")
    await db.commit()
    return await get_slo(slo_id, user, db)


@router.delete("/{slo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slo(
    slo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text("DELETE FROM slos WHERE id = :id AND owner_id = :uid RETURNING id"),
        {"id": slo_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="SLO not found")
    await db.commit()


@router.get("/{slo_id}/history")
async def slo_history(
    slo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(text(_SELECT + " WHERE id = :id"), {"id": slo_id})
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="SLO not found")
    src = row.source if isinstance(row.source, dict) else json.loads(row.source or "{}")
    from_ms, to_ms = _window_bounds(int(row.time_window_days))
    if row.type == "metric":
        return await burndown_series(
            source=src,
            target_pct=float(row.target_pct),
            from_ms=from_ms,
            to_ms=to_ms,
        )
    return {
        "stepSeconds": 0,
        "fromMs": from_ms,
        "toMs": to_ms,
        "points": [],
    }


@router.get("/{slo_id}/burn-rate")
async def slo_burn_rate(
    slo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Short-window burn rates used by alert configuration.

    Returns the realised burn rate for the alert windows configured on this
    SLO (multiples of allowed budget). The frontend uses this to preview which
    alerts would be firing right now.
    """
    res = await db.execute(text(_SELECT + " WHERE id = :id"), {"id": slo_id})
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="SLO not found")

    alerts_res = await db.execute(
        text(
            "SELECT id, name, short_window_min, long_window_min, burn_threshold, "
            "severity, enabled FROM slo_burn_rate_alerts "
            "WHERE slo_id = :id ORDER BY created_at"
        ),
        {"id": slo_id},
    )
    alerts = list(alerts_res)
    if not alerts or row.type != "metric":
        return {"alerts": []}

    src = row.source if isinstance(row.source, dict) else json.loads(row.source or "{}")
    target = float(row.target_pct)
    now_ms = int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)

    out: list[dict[str, Any]] = []
    for a in alerts:
        for window_label, minutes in (
            ("short", int(a.short_window_min)),
            ("long", int(a.long_window_min)),
        ):
            from_ms = now_ms - minutes * 60_000
            ev = await evaluate_slo(
                slo_type=row.type,
                source=src,
                target_pct=target,
                warning_pct=None,
                from_ms=from_ms,
                to_ms=now_ms,
            )
            sli = ev.get("sliPct")
            if sli is None:
                burn = None
            else:
                bad_pct = (100 - sli) / 100
                budget_pct = (100 - target) / 100
                burn = (bad_pct / budget_pct) if budget_pct > 0 else 0.0
            out.append({
                "alertId": str(a.id),
                "name": a.name,
                "window": window_label,
                "windowMin": minutes,
                "burnRate": burn,
                "threshold": float(a.burn_threshold),
                "severity": a.severity,
                "enabled": bool(a.enabled),
                "firing": bool(burn is not None and burn >= float(a.burn_threshold) and a.enabled),
            })
    return {"alerts": out}


@router.get("/{slo_id}/burn-rate-alerts")
async def list_burn_rate_alerts(
    slo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    # Ownership check
    res = await db.execute(
        text("SELECT owner_id FROM slos WHERE id = :id"), {"id": slo_id}
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="SLO not found")

    alerts = await db.execute(
        text(
            "SELECT id, name, short_window_min, long_window_min, burn_threshold, "
            "severity, enabled, created_at FROM slo_burn_rate_alerts "
            "WHERE slo_id = :id ORDER BY created_at"
        ),
        {"id": slo_id},
    )
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "shortWindowMin": int(a.short_window_min),
            "longWindowMin": int(a.long_window_min),
            "burnThreshold": float(a.burn_threshold),
            "severity": a.severity,
            "enabled": bool(a.enabled),
            "createdMs": int(a.created_at.timestamp() * 1000),
        }
        for a in alerts
    ]


@router.post("/{slo_id}/burn-rate-alerts", status_code=status.HTTP_201_CREATED)
async def create_burn_rate_alert(
    slo_id: str,
    body: BurnRateAlertCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text("SELECT owner_id FROM slos WHERE id = :id"), {"id": slo_id}
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="SLO not found")
    if body.severity not in ("warn", "alert"):
        raise HTTPException(status_code=400, detail="severity must be 'warn' or 'alert'")
    if body.short_window_min <= 0 or body.long_window_min <= 0:
        raise HTTPException(status_code=400, detail="windows must be positive")
    if body.burn_threshold <= 0:
        raise HTTPException(status_code=400, detail="burn_threshold must be positive")

    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO slo_burn_rate_alerts (
                id, slo_id, name, short_window_min, long_window_min,
                burn_threshold, severity, enabled
            ) VALUES (
                :id, :slo_id, :name, :short_min, :long_min,
                :threshold, :severity, :enabled
            )
            """
        ),
        {
            "id": new_id,
            "slo_id": slo_id,
            "name": body.name,
            "short_min": body.short_window_min,
            "long_min": body.long_window_min,
            "threshold": body.burn_threshold,
            "severity": body.severity,
            "enabled": body.enabled,
        },
    )
    await db.commit()
    return {
        "id": str(new_id),
        "name": body.name,
        "shortWindowMin": body.short_window_min,
        "longWindowMin": body.long_window_min,
        "burnThreshold": body.burn_threshold,
        "severity": body.severity,
        "enabled": body.enabled,
    }


@router.delete(
    "/{slo_id}/burn-rate-alerts/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_burn_rate_alert(
    slo_id: str,
    alert_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text("SELECT owner_id FROM slos WHERE id = :id"), {"id": slo_id}
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="SLO not found")
    await db.execute(
        text(
            "DELETE FROM slo_burn_rate_alerts WHERE id = :aid AND slo_id = :sid"
        ),
        {"aid": alert_id, "sid": slo_id},
    )
    await db.commit()
