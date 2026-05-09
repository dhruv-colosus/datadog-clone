"""APM endpoints — match `apps/web/src/features/apm/api.ts`.

Endpoint surface (P0 from the APM spec):
- Service catalog:        GET  /apm/services
- Service detail:         GET  /apm/services/{name}
                           - operations:    GET /apm/services/{name}/operations
                           - resources:     GET /apm/services/{name}/resources
                           - service ts:    GET /apm/services/{name}/series
                           - resource ts:   GET /apm/services/{name}/resources-series
- Dependencies graph:     GET  /apm/dependencies          (static topology edges)
                           GET  /apm/service-map           (live nodes+edges)
- Trace search:           POST /apm/spans/search
                           POST /apm/spans/facets
- Trace detail (flame):   GET  /apm/traces/{trace_id}
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.telemetry import queries
from app.telemetry.generators.traces import mock_trace_for_id
from app.telemetry.pool import get_pool
from app.telemetry.topology import (
    DEPENDENCIES,
    SERVICES,
    Service,
)


router = APIRouter(prefix="/apm", tags=["apm"])


def _service_to_dict(s: Service, stats: dict[str, Any] | None) -> dict[str, Any]:
    error_rate = stats.get("errorRate") if stats else 0.0
    if error_rate is not None and error_rate > 0.05:
        health = "critical"
    elif error_rate is not None and error_rate > 0.01:
        health = "warn"
    else:
        health = "ok"
    return {
        "id": s.name,
        "name": s.name,
        "type": s.type,
        "language": s.language or "n/a",
        "env": "prod",
        "health": health,
        "team": s.team,
        "tier": s.tier,
        "description": s.description,
        "requestsPerSec": stats["rps"] if stats else 0.0,
        "errorRate": stats["errorRate"] if stats else None,
        "p50LatencyMs": stats["p50LatencyMs"] if stats else 0.0,
        "p95LatencyMs": stats["p95LatencyMs"] if stats else 0.0,
        "p99LatencyMs": stats["p99LatencyMs"] if stats else 0.0,
        "totalRequests": stats["hits"] if stats else 0,
        "totalErrors": stats["errors"] if stats else 0,
        "lastDeployMinutesAgo": None,
    }


# ---------------------------------------------------------------------------
# Service catalog + detail
# ---------------------------------------------------------------------------


@router.get("/services")
async def list_services(
    env: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    stats = await queries.apm_service_stats(env=env)
    by_name = {s["name"]: s for s in stats}
    return [_service_to_dict(s, by_name.get(s.name)) for s in SERVICES]


@router.get("/services/{name}")
async def get_service(
    name: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    service = next((s for s in SERVICES if s.name == name), None)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    stats = await queries.apm_service_stats()
    by_name = {s["name"]: s for s in stats}
    return _service_to_dict(service, by_name.get(name))


@router.get("/services/{name}/operations")
async def list_operations(
    name: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT operation, COUNT(*) AS hits,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
                   percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_us) AS p50_us,
                   percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us,
                   percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_us) AS p99_us
            FROM spans
            WHERE service = $1 AND ts >= NOW() - INTERVAL '15 minutes'
            GROUP BY operation ORDER BY hits DESC
            """,
            name,
        )
    return [
        {
            "name": r["operation"],
            "hits": int(r["hits"] or 0),
            "errors": int(r["errors"] or 0),
            "p50LatencyMs": float(r["p50_us"] or 0) / 1000.0,
            "p95LatencyMs": float(r["p95_us"] or 0) / 1000.0,
            "p99LatencyMs": float(r["p99_us"] or 0) / 1000.0,
        }
        for r in rows
    ]


@router.get("/services/{name}/resources")
async def list_resources(
    name: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT resource, COUNT(*) AS hits,
                   SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
                   SUM(duration_us)::float8 / 1000 AS total_ms,
                   percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us
            FROM spans
            WHERE service = $1 AND ts >= NOW() - INTERVAL '15 minutes'
            GROUP BY resource ORDER BY hits DESC LIMIT 50
            """,
            name,
        )
    out: list[dict[str, Any]] = []
    for i, r in enumerate(rows):
        hits = int(r["hits"] or 0)
        errors = int(r["errors"] or 0)
        out.append({
            "id": f"{name}-{i}",
            "name": r["resource"],
            "service": name,
            "requests": hits,
            "totalTimeMs": float(r["total_ms"] or 0),
            "p95LatencyMs": float(r["p95_us"] or 0) / 1000.0,
            "errors": errors,
            "errorRate": (errors / hits) if hits else 0.0,
        })
    return out


@router.get("/services/{name}/series")
async def get_service_series(
    name: str,
    fromMs: int = Query(...),
    toMs: int = Query(...),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    pts = await queries.apm_service_series(service=name, from_ms=fromMs, to_ms=toMs)
    return {"service": name, "points": pts}


@router.get("/services/{name}/resources-series")
async def get_resource_series(
    name: str,
    fromMs: int = Query(...),
    toMs: int = Query(...),
    topN: int = Query(default=5, ge=1, le=20),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return await queries.apm_resource_top_series(
        service=name, from_ms=fromMs, to_ms=toMs, top_n=topN,
    )


# ---------------------------------------------------------------------------
# Dependencies / service map
# ---------------------------------------------------------------------------


@router.get("/dependencies")
async def get_dependencies(
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Static topology edges from `topology.py` — used as a fallback when
    no span traffic has been observed yet (cold-start scenario).
    """
    return [
        {"caller": d.caller, "callee": d.callee, "kind": d.kind, "weight": d.weight}
        for d in DEPENDENCIES
    ]


@router.get("/service-map")
async def get_service_map(
    env: str | None = Query(default=None),
    lookbackSeconds: int = Query(default=600, ge=60, le=86400),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Live service map: every service that has emitted spans in the lookback
    window plus every parent→child edge actually observed in those spans.

    Edges fall back to the static topology when traffic is sparse so the map
    isn't empty on a freshly seeded DB."""
    live = await queries.apm_service_map(env=env, lookback_seconds=lookbackSeconds)

    nodes_by_name = {n["service"]: n for n in live["nodes"]}
    # Always represent every canonical service as a node, even if it had no
    # traffic — keeps the map shape stable across windows.
    for s in SERVICES:
        if s.name not in nodes_by_name:
            nodes_by_name[s.name] = {
                "service": s.name,
                "hits": 0,
                "errors": 0,
                "errorRate": 0.0,
                "rps": 0.0,
                "p95LatencyMs": 0.0,
            }

    nodes = []
    for s in SERVICES:
        n = nodes_by_name[s.name]
        err_rate = float(n.get("errorRate") or 0.0)
        if err_rate > 0.05:
            health = "critical"
        elif err_rate > 0.01:
            health = "warning"
        else:
            health = "ok"
        inferred = s.type in ("db", "cache")
        nodes.append({
            **n,
            "type": s.type,
            "language": s.language or "n/a",
            "team": s.team,
            "tier": s.tier,
            "healthState": health,
            "inferred": inferred,
        })

    seen = {(e["caller"], e["callee"]) for e in live["edges"]}
    edges: list[dict[str, Any]] = list(live["edges"])
    for d in DEPENDENCIES:
        if (d.caller, d.callee) not in seen:
            edges.append({
                "caller": d.caller,
                "callee": d.callee,
                "calls": 0,
                "errors": 0,
                "kind": d.kind,
            })
        else:
            for e in edges:
                if e["caller"] == d.caller and e["callee"] == d.callee:
                    e["kind"] = d.kind
                    break
    for e in edges:
        calls = int(e.get("calls") or 0)
        errors = int(e.get("errors") or 0)
        e["callRate"] = calls / max(1, lookbackSeconds)
        e["errorRate"] = (errors / calls) if calls else 0.0
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# Trace explorer — span search + facets + flame graph
# ---------------------------------------------------------------------------


class SpanSearchRange(BaseModel):
    fromMs: int
    toMs: int


class SpanSearchQuery(BaseModel):
    text: str = ""
    services: list[str] = Field(default_factory=list)
    statuses: list[str] = Field(default_factory=list)
    resources: list[str] = Field(default_factory=list)
    env: str | None = None


class SpanSearchRequest(BaseModel):
    query: SpanSearchQuery
    range: SpanSearchRange
    limit: int = 200


@router.post("/spans/search")
async def post_spans_search(
    body: SpanSearchRequest,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return await queries.apm_search_spans(
        from_ms=body.range.fromMs,
        to_ms=body.range.toMs,
        services=body.query.services or None,
        statuses=body.query.statuses or None,
        resources=body.query.resources or None,
        env=body.query.env,
        free_text=body.query.text,
        limit=body.limit,
    )


@router.post("/spans/facets")
async def post_spans_facets(
    body: SpanSearchRequest,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    return await queries.apm_span_facets(
        from_ms=body.range.fromMs,
        to_ms=body.range.toMs,
        services=body.query.services or None,
        statuses=body.query.statuses or None,
        resources=body.query.resources or None,
        env=body.query.env,
        free_text=body.query.text,
    )


@router.get("/traces/{trace_id}")
async def get_trace(
    trace_id: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    spans = await queries.apm_get_trace(trace_id)
    is_mock = False
    if not spans:
        # No real trace — serve one of 5 deterministic mock shapes so log →
        # trace navigation never dead-ends (covers phantom IDs from older
        # logs and aged-out traces alike). Picked deterministically from
        # trace_id so the same ID always returns the same mock.
        anchor = dt.datetime.now(dt.timezone.utc).timestamp()
        spans = [_mock_span_to_dict(s) for s in mock_trace_for_id(trace_id, anchor)]
        is_mock = True
    # Compute trace-level rollups so the flame-graph header can render
    # without the client recomputing.
    t_start = min(s["tsMs"] for s in spans)
    t_end = max(s["tsMs"] + s["durationMs"] for s in spans)
    services = sorted({s["service"] for s in spans})
    return {
        "traceId": trace_id,
        "spans": spans,
        "startMs": t_start,
        "endMs": t_end,
        "durationMs": t_end - t_start,
        "spanCount": len(spans),
        "errorCount": sum(1 for s in spans if s["status"] == "error"),
        "services": services,
        "isMock": is_mock,
    }


def _mock_span_to_dict(span: Any) -> dict[str, Any]:
    """Match the shape `apm_get_trace` returns from the DB."""
    return {
        "tsMs": int(span.ts_seconds * 1000),
        "traceId": span.trace_id,
        "spanId": span.span_id,
        "parentSpanId": span.parent_span_id,
        "service": span.service,
        "operation": span.operation,
        "resource": span.resource,
        "durationMs": span.duration_us / 1000.0,
        "status": "error" if span.status == 1 else "ok",
        "httpMethod": span.http_method,
        "httpStatus": span.http_status,
        "host": span.host,
        "env": span.env,
        "tags": dict(span.tags),
    }


# ---------------------------------------------------------------------------
# Recommendations (static fixture; out of P0 scope)
# ---------------------------------------------------------------------------


@router.get("/watchdog")
async def list_watchdog(
    lookbackHours: int = Query(default=48, ge=1, le=168),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """APM Watchdog anomalies — error-rate spikes per (service, resource)."""
    return await queries.apm_watchdog_anomalies(lookback_hours=lookbackHours)


@router.get("/issues")
async def list_issues(
    lookbackSeconds: int = Query(default=3600, ge=60, le=86400),
    limit: int = Query(default=20, ge=1, le=100),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """APM Issues — error spans aggregated by (service, resource)."""
    return await queries.apm_issues(lookback_seconds=lookbackSeconds, limit=limit)


@router.get("/recommendations")
async def list_recommendations(
    type: str | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    fixture = [
        {"id": "r1", "title": "Reduce p99 on api.web.request",
         "type": "performance", "service": "api",
         "description": "p99 climbed >150ms over the last hour."},
        {"id": "r2", "title": "Add retry on payments.charge",
         "type": "reliability", "service": "payments",
         "description": "Error rate spiked above 2% — consider exponential backoff."},
        {"id": "r3", "title": "Drop unused indexes on `orders`",
         "type": "cost", "service": "postgres",
         "description": "Disk usage grew faster than table growth."},
    ]
    if type:
        return [r for r in fixture if r["type"] == type]
    return fixture
