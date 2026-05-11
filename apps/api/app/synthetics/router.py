"""Synthetic tests CRUD + run-now + results history.

Two test types are persisted in `synthetic_tests`:
    * ``api`` — single HTTP/gRPC/SSL/DNS request with assertions. The
      executor runs the request live against the target.
    * ``browser`` — recorded UI steps run against a starting URL. We
      simulate a successful browser run server-side (we don't drive a
      real headless browser in this clone), but the UI matches the
      shape Datadog returns.
"""

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
from app.synthetics.executor import (
    execute_browser_with_locations,
    execute_with_locations,
)


router = APIRouter(prefix="/synthetics", tags=["synthetics"])


TestType = Literal["api", "browser", "multistep"]
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


class BrowserStep(BaseModel):
    """A single recorded step in a browser test."""
    id: str
    type: str  # goto | click | type | wait | hover | scroll | assert_contains | assert_url | assert_element
    target: str | None = None  # CSS selector or URL
    value: str | None = None  # text to type, expected value, etc.
    ms: int | None = None  # wait duration, ms


class BrowserConfig(BaseModel):
    startingUrl: str = ""
    browsers: list[str] = Field(default_factory=lambda: ["chrome", "firefox"])
    devices: list[str] = Field(default_factory=lambda: ["laptop_large"])
    steps: list[BrowserStep] = Field(default_factory=list)


class AuthConfig(BaseModel):
    type: str = "none"  # none | basic | bearer | api_key | hmac | digest | ntlm | oauth2 | aws_sigv4
    username: str | None = None
    password: str | None = None
    token: str | None = None
    keyName: str | None = None
    keyValue: str | None = None
    keyLocation: str | None = "header"  # header | query


class RetryConfig(BaseModel):
    count: int = 0
    intervalMs: int = 300


class AlertCondition(BaseModel):
    failingMinutes: int = 0
    fromLocations: int = 1


class DowntimeWindow(BaseModel):
    startMs: int
    endMs: int
    reason: str = ""


class SyntheticTestCreate(BaseModel):
    name: str
    test_type: TestType = "api"
    subtype: Subtype = "http"
    method: HttpMethod = "GET"
    url: str = ""
    request: SyntheticRequest = Field(default_factory=SyntheticRequest)
    assertions: list[SyntheticAssertion] = Field(default_factory=list)
    browser_config: BrowserConfig = Field(default_factory=BrowserConfig)
    auth: AuthConfig = Field(default_factory=AuthConfig)
    retry: RetryConfig = Field(default_factory=RetryConfig)
    alert_condition: AlertCondition = Field(default_factory=AlertCondition)
    monitor_message: str = ""
    downtimes: list[DowntimeWindow] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=lambda: ["aws:us-east-1"])
    frequency_seconds: int = 300
    tags: list[str] = Field(default_factory=list)
    environment: str | None = None
    team: str | None = None
    enabled: bool = True
    favorite: bool = False


class SyntheticTestPatch(BaseModel):
    name: str | None = None
    test_type: TestType | None = None
    subtype: Subtype | None = None
    method: HttpMethod | None = None
    url: str | None = None
    request: SyntheticRequest | None = None
    assertions: list[SyntheticAssertion] | None = None
    browser_config: BrowserConfig | None = None
    auth: AuthConfig | None = None
    retry: RetryConfig | None = None
    alert_condition: AlertCondition | None = None
    monitor_message: str | None = None
    downtimes: list[DowntimeWindow] | None = None
    locations: list[str] | None = None
    frequency_seconds: int | None = None
    tags: list[str] | None = None
    environment: str | None = None
    team: str | None = None
    enabled: bool | None = None
    favorite: bool | None = None


class RunOnceRequest(BaseModel):
    """Body for ad-hoc test execution from the editor (Send button)."""
    test_type: TestType = "api"
    method: HttpMethod = "GET"
    url: str
    request: SyntheticRequest = Field(default_factory=SyntheticRequest)
    assertions: list[SyntheticAssertion] = Field(default_factory=list)
    browser_config: BrowserConfig | None = None
    auth: AuthConfig = Field(default_factory=AuthConfig)
    locations: list[str] = Field(default_factory=lambda: ["aws:us-east-1"])


_SELECT_TEST = (
    "SELECT id, owner_id, name, test_type, subtype, method, url, request, "
    "assertions, browser_config, auth, retry_config, alert_condition, "
    "monitor_message, downtimes, locations, frequency_seconds, tags, "
    "environment, team, enabled, favorite, last_status, last_run_at, "
    "created_at, updated_at "
    "FROM synthetic_tests"
)


def _as_dict(val: Any, default: Any) -> Any:
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    try:
        return json.loads(val)
    except (TypeError, ValueError):
        return default


def _row_to_dict(row) -> dict[str, Any]:
    request = _as_dict(row.request, {})
    assertions = _as_dict(row.assertions, [])
    browser_config = _as_dict(row.browser_config, {})
    auth = _as_dict(row.auth, {"type": "none"})
    retry_config = _as_dict(row.retry_config, {"count": 0, "intervalMs": 300})
    alert_condition = _as_dict(
        row.alert_condition, {"failingMinutes": 0, "fromLocations": 1}
    )
    downtimes = _as_dict(row.downtimes, [])
    return {
        "id": str(row.id),
        "name": row.name,
        "testType": row.test_type,
        "subtype": row.subtype,
        "method": row.method,
        "url": row.url,
        "request": request,
        "assertions": assertions,
        "browserConfig": browser_config,
        "auth": auth,
        "retry": retry_config,
        "alertCondition": alert_condition,
        "monitorMessage": row.monitor_message or "",
        "downtimes": downtimes,
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
    timings = _as_dict(row.timings, {})
    a_results = _as_dict(row.assertion_results, [])
    headers = _as_dict(row.response_headers, {})
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

    effective_url = body.url.strip()
    if body.test_type == "browser":
        effective_url = body.browser_config.startingUrl.strip() or effective_url
        if not effective_url:
            raise HTTPException(status_code=400, detail="Starting URL is required")
    elif not effective_url:
        raise HTTPException(status_code=400, detail="URL is required")

    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO synthetic_tests (
                id, owner_id, name, test_type, subtype, method, url,
                request, assertions, browser_config, auth, retry_config,
                alert_condition, monitor_message, downtimes,
                locations, frequency_seconds, tags, environment, team,
                enabled, favorite
            ) VALUES (
                :id, :owner, :name, :test_type, :subtype, :method, :url,
                CAST(:request AS jsonb),
                CAST(:assertions AS jsonb),
                CAST(:browser_config AS jsonb),
                CAST(:auth AS jsonb),
                CAST(:retry_config AS jsonb),
                CAST(:alert_condition AS jsonb),
                :monitor_message,
                CAST(:downtimes AS jsonb),
                :locations, :frequency,
                :tags, :env, :team, :enabled, :favorite
            )
            """
        ),
        {
            "id": new_id,
            "owner": user.id,
            "name": body.name.strip() or "Untitled Synthetic Test",
            "test_type": body.test_type,
            "subtype": body.subtype,
            "method": body.method,
            "url": effective_url,
            "request": json.dumps(body.request.model_dump()),
            "assertions": json.dumps([a.model_dump() for a in body.assertions]),
            "browser_config": json.dumps(body.browser_config.model_dump()),
            "auth": json.dumps(body.auth.model_dump()),
            "retry_config": json.dumps(body.retry.model_dump()),
            "alert_condition": json.dumps(body.alert_condition.model_dump()),
            "monitor_message": body.monitor_message or "",
            "downtimes": json.dumps([d.model_dump() for d in body.downtimes]),
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


_JSONB_FIELDS = {
    "request": "request",
    "assertions": "assertions",
    "browser_config": "browser_config",
    "auth": "auth",
    "retry": "retry_config",
    "alert_condition": "alert_condition",
    "downtimes": "downtimes",
}


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
        if key in _JSONB_FIELDS:
            col = _JSONB_FIELDS[key]
            params[col] = json.dumps(val) if val is not None else "null"
            set_parts.append(f"{col} = CAST(:{col} AS jsonb)")
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
        elif key == "monitor_message":
            params["monitor_message"] = val or ""
            set_parts.append("monitor_message = :monitor_message")
        elif key == "test_type":
            params["test_type"] = val
            set_parts.append("test_type = :test_type")
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
    locations = test.get("locations") or ["aws:us-east-1"]
    if test.get("testType") == "browser":
        results = await execute_browser_with_locations(
            starting_url=(test.get("browserConfig") or {}).get("startingUrl")
            or test.get("url")
            or "",
            steps=(test.get("browserConfig") or {}).get("steps") or [],
            browsers=(test.get("browserConfig") or {}).get("browsers") or ["chrome"],
            devices=(test.get("browserConfig") or {}).get("devices") or ["laptop_large"],
            locations=locations,
        )
    else:
        results = await execute_with_locations(
            method=test["method"],
            url=test["url"],
            request=test.get("request") or {},
            assertions=test.get("assertions") or [],
            auth=test.get("auth") or {"type": "none"},
            locations=locations,
        )
    return await _persist_results(db, test_id, results)


@router.post("/run-once")
async def run_once(
    body: RunOnceRequest,
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> list[dict[str, Any]]:
    """Run an unsaved test from the editor (Send button) — does not persist."""
    if body.test_type == "browser":
        bc = body.browser_config or BrowserConfig()
        starting = bc.startingUrl.strip() or body.url.strip()
        if not starting:
            raise HTTPException(status_code=400, detail="Starting URL is required")
        results = await execute_browser_with_locations(
            starting_url=starting,
            steps=[s.model_dump() for s in bc.steps],
            browsers=bc.browsers or ["chrome"],
            devices=bc.devices or ["laptop_large"],
            locations=body.locations or ["aws:us-east-1"],
        )
    else:
        if not body.url.strip():
            raise HTTPException(status_code=400, detail="URL is required")
        results = await execute_with_locations(
            method=body.method,
            url=body.url,
            request=body.request.model_dump(),
            assertions=[a.model_dump() for a in body.assertions],
            auth=body.auth.model_dump(),
            locations=body.locations or ["aws:us-east-1"],
        )
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


@router.get("/events")
async def list_events(
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Recent triggered/recovered events across the user's synthetic tests."""
    res = await db.execute(
        text(
            """
            SELECT r.id, r.executed_at, r.location, r.status,
                   t.name AS test_name, t.id AS test_id, t.url
            FROM synthetic_results r
            JOIN synthetic_tests t ON t.id = r.test_id
            WHERE t.owner_id = :uid
            ORDER BY r.executed_at DESC
            LIMIT :limit
            """
        ),
        {"uid": user.id, "limit": limit},
    )
    out: list[dict[str, Any]] = []
    for row in res:
        verb = "Triggered" if row.status == "ALERT" else "Recovered"
        out.append(
            {
                "id": str(row.id),
                "testId": str(row.test_id),
                "executedMs": int(row.executed_at.timestamp() * 1000),
                "location": row.location,
                "status": row.status,
                "message": (
                    f"[{verb} on {{{row.location}}}] [Synthetics] "
                    f"Test on {row.test_name}"
                ),
            }
        )
    return out


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

    overall = "ALERT" if any(r["status"] == "ALERT" for r in results) else "OK"
    await db.execute(
        text(
            "UPDATE synthetic_tests SET last_status = :s, last_run_at = NOW() "
            "WHERE id = :id"
        ),
        {"s": overall, "id": test_id},
    )

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
