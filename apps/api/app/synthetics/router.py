"""Synthetic tests CRUD + run-now + results history."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.synthetics.executor import execute_test, execute_with_locations


router = APIRouter(prefix="/synthetics", tags=["synthetics"])


HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
Subtype = Literal["http", "ssl", "dns", "tcp", "udp", "icmp", "websocket", "grpc"]


class SyntheticHeader(BaseModel):
    key: str
    value: str


class SyntheticRequest(BaseModel):
    headers: list[SyntheticHeader] = Field(default_factory=list)
    query: list[SyntheticHeader] = Field(default_factory=list)
    body: str | None = None
    bodyType: str = "raw"  # "raw" | "json" | "form"
    timeoutMs: int = 15_000


class SyntheticAssertion(BaseModel):
    type: str  # status_code | response_time | header | body | body_size
    operator: str = "is"
    expected: Any | None = None
    target: str | None = None  # for header lookups


class SyntheticTestCreate(BaseModel):
    name: str
    subtype: Subtype = "http"
    method: HttpMethod = "GET"
    url: str
    request: SyntheticRequest = Field(default_factory=SyntheticRequest)
    assertions: list[SyntheticAssertion] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=lambda: ["aws:us-east-1"])
    frequency_seconds: int = 300
    tags: list[str] = Field(default_factory=list)
    environment: str | None = None
    team: str | None = None
    enabled: bool = True
    favorite: bool = False


class SyntheticTestPatch(BaseModel):
    name: str | None = None
    subtype: Subtype | None = None
    method: HttpMethod | None = None
    url: str | None = None
    request: SyntheticRequest | None = None
    assertions: list[SyntheticAssertion] | None = None
    locations: list[str] | None = None
    frequency_seconds: int | None = None
    tags: list[str] | None = None
    environment: str | None = None
    team: str | None = None
    enabled: bool | None = None
    favorite: bool | None = None


class RunOnceRequest(BaseModel):
    """Body for ad-hoc test execution from the editor (Send button)."""
    method: HttpMethod = "GET"
    url: str
    request: SyntheticRequest = Field(default_factory=SyntheticRequest)
    assertions: list[SyntheticAssertion] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=lambda: ["aws:us-east-1"])


_SELECT_TEST = (
    "SELECT id, owner_id, name, subtype, method, url, request, assertions, "
    "locations, frequency_seconds, tags, environment, team, enabled, "
    "favorite, last_status, last_run_at, created_at, updated_at "
    "FROM synthetic_tests"
)


def _row_to_dict(row) -> dict[str, Any]:
    request = (
        row.request if isinstance(row.request, dict) else json.loads(row.request or "{}")
    )
    assertions = (
        row.assertions
        if isinstance(row.assertions, list)
        else json.loads(row.assertions or "[]")
    )
    return {
        "id": str(row.id),
        "name": row.name,
        "subtype": row.subtype,
        "method": row.method,
        "url": row.url,
        "request": request,
        "assertions": assertions,
        "locations": list(row.locations or []),
        "frequencySeconds": int(row.frequency_seconds),
        "tags": list(row.tags or []),
        "environment": row.environment,
        "team": row.team,
        "enabled": bool(row.enabled),
        "favorite": bool(row.favorite),
        "lastStatus": row.last_status,
        "lastRunMs": (
            int(row.last_run_at.timestamp() * 1000) if row.last_run_at else None
        ),
        "ownerId": row.owner_id,
        "createdMs": int(row.created_at.timestamp() * 1000),
        "modifiedMs": int(row.updated_at.timestamp() * 1000),
    }


def _result_row_to_dict(row) -> dict[str, Any]:
    timings = (
        row.timings if isinstance(row.timings, dict) else json.loads(row.timings or "{}")
    )
    a_results = (
        row.assertion_results
        if isinstance(row.assertion_results, list)
        else json.loads(row.assertion_results or "[]")
    )
    headers = (
        row.response_headers
        if isinstance(row.response_headers, dict)
        else json.loads(row.response_headers or "{}")
    )
    return {
        "id": str(row.id),
        "testId": str(row.test_id),
        "executedMs": int(row.executed_at.timestamp() * 1000),
        "location": row.location,
        "status": row.status,
        "statusCode": row.status_code,
        "responseTimeMs": row.response_time_ms,
        "timings": timings,
        "assertionResults": a_results,
        "responseHeaders": headers,
        "responseSizeBytes": row.response_size_bytes,
        "errorMessage": row.error_message,
    }


@router.get("/tests")
async def list_tests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(_SELECT_TEST + " WHERE owner_id = :uid ORDER BY updated_at DESC"),
        {"uid": user.id},
    )
    return [_row_to_dict(r) for r in res]


@router.post("/tests", status_code=status.HTTP_201_CREATED)
async def create_test(
    body: SyntheticTestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if body.frequency_seconds < 60:
        raise HTTPException(status_code=400, detail="frequency_seconds must be >= 60")
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO synthetic_tests (
                id, owner_id, name, subtype, method, url,
                request, assertions, locations, frequency_seconds,
                tags, environment, team, enabled, favorite
            ) VALUES (
                :id, :owner, :name, :subtype, :method, :url,
                CAST(:request AS jsonb),
                CAST(:assertions AS jsonb),
                :locations, :frequency,
                :tags, :env, :team, :enabled, :favorite
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": body.name.strip() or "Untitled Synthetic Test",
            "subtype": body.subtype,
            "method": body.method,
            "url": body.url.strip(),
            "request": json.dumps(body.request.model_dump()),
            "assertions": json.dumps([a.model_dump() for a in body.assertions]),
            "locations": list(body.locations or ["aws:us-east-1"]),
            "frequency": body.frequency_seconds,
            "tags": list(body.tags or []),
            "env": body.environment,
            "team": body.team,
            "enabled": body.enabled,
            "favorite": body.favorite,
        },
    )
    await db.commit()
    return await get_test(str(new_id), user, db)


@router.get("/tests/{test_id}")
async def get_test(
    test_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(_SELECT_TEST + " WHERE id = :id"),
        {"id": test_id},
    )
    row = res.first()
    if row is None or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Synthetic test not found")
    return _row_to_dict(row)


@router.patch("/tests/{test_id}")
async def patch_test(
    test_id: str,
    body: SyntheticTestPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return await get_test(test_id, user, db)

    set_parts: list[str] = []
    params: dict[str, Any] = {"id": test_id, "uid": user.id}

    for key, val in fields.items():
        if key == "request":
            params["request"] = json.dumps(val) if val is not None else "{}"
            set_parts.append("request = CAST(:request AS jsonb)")
        elif key == "assertions":
            params["assertions"] = json.dumps(val) if val is not None else "[]"
            set_parts.append("assertions = CAST(:assertions AS jsonb)")
        elif key == "locations":
            params["locations"] = list(val or [])
            set_parts.append("locations = :locations")
        elif key == "tags":
            params["tags"] = list(val or [])
            set_parts.append("tags = :tags")
        elif key == "frequency_seconds":
            if val is not None and int(val) < 60:
                raise HTTPException(
                    status_code=400, detail="frequency_seconds must be >= 60"
                )
            params["frequency_seconds"] = val
            set_parts.append("frequency_seconds = :frequency_seconds")
        elif key == "environment":
            params["environment"] = val
            set_parts.append("environment = :environment")
        else:
            params[key] = val
            set_parts.append(f"{key} = :{key}")

    set_parts.append("updated_at = NOW()")
    sql = (
        f"UPDATE synthetic_tests SET {', '.join(set_parts)} "
        f"WHERE id = :id AND owner_id = :uid RETURNING id"
    )
    res = await db.execute(text(sql), params)
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Synthetic test not found")
    await db.commit()
    return await get_test(test_id, user, db)


@router.delete("/tests/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        text(
            "DELETE FROM synthetic_tests WHERE id = :id AND owner_id = :uid "
            "RETURNING id"
        ),
        {"id": test_id, "uid": user.id},
    )
    if res.first() is None:
        raise HTTPException(status_code=404, detail="Synthetic test not found")
    await db.commit()


@router.post("/tests/{test_id}/run")
async def run_test(
    test_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Execute a saved test now and persist results."""
    test = await get_test(test_id, user, db)
    results = await execute_with_locations(
        method=test["method"],
        url=test["url"],
        request=test.get("request") or {},
        assertions=test.get("assertions") or [],
        locations=test.get("locations") or ["aws:us-east-1"],
    )
    return await _persist_results(db, test_id, results)


@router.post("/run-once")
async def run_once(
    body: RunOnceRequest,
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> list[dict[str, Any]]:
    """Run an unsaved test from the editor (Send button) — does not persist."""
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")
    results = await execute_with_locations(
        method=body.method,
        url=body.url,
        request=body.request.model_dump(),
        assertions=[a.model_dump() for a in body.assertions],
        locations=body.locations or ["aws:us-east-1"],
    )
    # Wrap in client-shaped objects (no testId/executedMs from DB).
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return [
        {
            "id": str(uuid.uuid4()),
            "testId": None,
            "executedMs": now_ms,
            "location": r["location"],
            "status": r["status"],
            "statusCode": r["status_code"],
            "responseTimeMs": r["response_time_ms"],
            "timings": r["timings"],
            "assertionResults": r["assertion_results"],
            "responseHeaders": r["response_headers"],
            "responseSizeBytes": r["response_size_bytes"],
            "errorMessage": r["error_message"],
        }
        for r in results
    ]


@router.get("/tests/{test_id}/results")
async def list_results(
    test_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    # Ownership check
    await get_test(test_id, user, db)
    res = await db.execute(
        text(
            """
            SELECT id, test_id, executed_at, location, status, status_code,
                   response_time_ms, timings, assertion_results,
                   response_headers, response_size_bytes, error_message
            FROM synthetic_results
            WHERE test_id = :id
            ORDER BY executed_at DESC
            LIMIT :limit
            """
        ),
        {"id": test_id, "limit": limit},
    )
    return [_result_row_to_dict(r) for r in res]


async def _persist_results(
    db: AsyncSession,
    test_id: str,
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Insert each location result, update last_status on the parent."""
    saved: list[dict[str, Any]] = []
    for r in results:
        new_id = uuid.uuid4()
        res = await db.execute(
            text(
                """
                INSERT INTO synthetic_results (
                    id, test_id, location, status, status_code, response_time_ms,
                    timings, assertion_results, response_headers,
                    response_size_bytes, error_message
                ) VALUES (
                    :id, :test_id, :location, :status, :code, :rt,
                    CAST(:timings AS jsonb),
                    CAST(:assertions AS jsonb),
                    CAST(:headers AS jsonb),
                    :size, :err
                ) RETURNING id, test_id, executed_at, location, status,
                            status_code, response_time_ms, timings,
                            assertion_results, response_headers,
                            response_size_bytes, error_message
                """
            ),
            {
                "id": new_id,
                "test_id": test_id,
                "location": r["location"],
                "status": r["status"],
                "code": r["status_code"],
                "rt": r["response_time_ms"],
                "timings": json.dumps(r["timings"]),
                "assertions": json.dumps(r["assertion_results"]),
                "headers": json.dumps(r["response_headers"]),
                "size": r["response_size_bytes"],
                "err": r["error_message"],
            },
        )
        row = res.first()
        if row is not None:
            saved.append(_result_row_to_dict(row))

    # Aggregate status: ALERT if any location alerted.
    overall = "ALERT" if any(r["status"] == "ALERT" for r in results) else "OK"
    await db.execute(
        text(
            "UPDATE synthetic_tests SET last_status = :s, last_run_at = NOW() "
            "WHERE id = :id"
        ),
        {"s": overall, "id": test_id},
    )

    # Trim history to 1000 most recent rows per test to keep the table small.
    await db.execute(
        text(
            """
            DELETE FROM synthetic_results
            WHERE test_id = :id
              AND id NOT IN (
                SELECT id FROM synthetic_results
                WHERE test_id = :id
                ORDER BY executed_at DESC
                LIMIT 1000
              )
            """
        ),
        {"id": test_id},
    )
    await db.commit()
    return saved
