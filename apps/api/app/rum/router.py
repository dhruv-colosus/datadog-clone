"""RUM API — backs the frontend `apps/web/src/features/rum/api.ts`.

Endpoint surface:
- Applications:           GET  /rum/applications
                          GET  /rum/applications/{id}
- Application summary:    GET  /rum/applications/{id}/summary
                          GET  /rum/applications/{id}/series
                          GET  /rum/applications/{id}/vitals
                          GET  /rum/applications/{id}/error-rate
                          GET  /rum/applications/{id}/deployments
                          GET  /rum/applications/{id}/resource-performance
                          GET  /rum/applications/{id}/top-views
- Session list:           GET  /rum/sessions
- Session detail+replay:  GET  /rum/sessions/{id}
- Errors / Error tracking: GET /rum/errors
- Performance explorer:   GET  /rum/views
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.rum.topology import APPLICATIONS, app_by_id
from app.telemetry.pool import get_pool


router = APIRouter(prefix="/rum", tags=["rum"])


def _from_to_or_default(from_ms: int | None, to_ms: int | None) -> tuple[dt.datetime, dt.datetime]:
    if to_ms is None:
        to = dt.datetime.now(dt.timezone.utc)
    else:
        to = dt.datetime.fromtimestamp(to_ms / 1000.0, tz=dt.timezone.utc)
    if from_ms is None:
        frm = to - dt.timedelta(days=1)
    else:
        frm = dt.datetime.fromtimestamp(from_ms / 1000.0, tz=dt.timezone.utc)
    return frm, to


def _bucket_for(window_seconds: float) -> str:
    """Pick a sensible histogram bucket for a given window."""
    if window_seconds <= 60 * 60:
        return "1 minute"
    if window_seconds <= 6 * 60 * 60:
        return "5 minutes"
    if window_seconds <= 24 * 60 * 60:
        return "15 minutes"
    if window_seconds <= 3 * 24 * 60 * 60:
        return "1 hour"
    return "3 hours"


def _app_dict(app, count: dict | None = None) -> dict[str, Any]:
    return {
        "id": app.id,
        "name": app.name,
        "type": app.type,
        "service": app.service,
        "env": app.env,
        "clientToken": app.client_token,
        "totalSessions": int(count.get("sessions", 0)) if count else 0,
        "totalViews": int(count.get("views", 0)) if count else 0,
        "totalErrors": int(count.get("errors", 0)) if count else 0,
    }


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------


@router.get("/applications")
async def list_applications(
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    pool = await get_pool()
    out: list[dict[str, Any]] = []
    async with pool.acquire() as conn:
        for app in APPLICATIONS:
            row = await conn.fetchrow(
                """
                SELECT
                  COUNT(DISTINCT session_id) AS sessions,
                  COUNT(*) FILTER (WHERE event_type = 'view') AS views,
                  COUNT(*) FILTER (WHERE event_type = 'error') AS errors
                FROM rum_events
                WHERE application_id = $1
                  AND ts >= NOW() - INTERVAL '1 day'
                """,
                app.id,
            )
            out.append(_app_dict(app, dict(row) if row else None))
    return out


@router.get("/applications/{app_id}")
async def get_application(
    app_id: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    app = app_by_id(app_id)
    if app is None:
        raise HTTPException(404, "Application not found")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
              COUNT(DISTINCT session_id) AS sessions,
              COUNT(*) FILTER (WHERE event_type = 'view') AS views,
              COUNT(*) FILTER (WHERE event_type = 'error') AS errors
            FROM rum_events
            WHERE application_id = $1
              AND ts >= NOW() - INTERVAL '1 day'
            """,
            app_id,
        )
    return _app_dict(app, dict(row) if row else None)


# ---------------------------------------------------------------------------
# Summary tab
# ---------------------------------------------------------------------------


@router.get("/applications/{app_id}/summary")
async def application_summary(
    app_id: str,
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    frm, to = _from_to_or_default(fromMs, toMs)
    prev_frm = frm - (to - frm)

    pool = await get_pool()
    async with pool.acquire() as conn:
        cur = await conn.fetchrow(
            """
            SELECT
              COUNT(*) FILTER (WHERE event_type = 'view') AS views,
              COUNT(DISTINCT session_id) AS sessions,
              COUNT(*) FILTER (WHERE event_type = 'error') AS errors,
              COUNT(*) FILTER (WHERE event_type = 'action') AS actions,
              COUNT(DISTINCT session_id) FILTER (
                WHERE event_type = 'session_summary' AND session_frustration_count > 0
              ) AS frustrated_sessions
            FROM rum_events
            WHERE application_id = $1 AND ts >= $2 AND ts < $3
            """,
            app_id, frm, to,
        )
        prev = await conn.fetchrow(
            """
            SELECT COUNT(*) FILTER (WHERE event_type = 'view') AS views
            FROM rum_events
            WHERE application_id = $1 AND ts >= $2 AND ts < $3
            """,
            app_id, prev_frm, frm,
        )
    cur_views = int(cur["views"] or 0) if cur else 0
    prev_views = int(prev["views"] or 0) if prev else 0
    pct = 0.0
    if prev_views > 0:
        pct = ((cur_views - prev_views) / prev_views) * 100.0
    elif cur_views > 0:
        pct = 100.0
    return {
        "totalViews": cur_views,
        "totalSessions": int(cur["sessions"] or 0) if cur else 0,
        "totalErrors": int(cur["errors"] or 0) if cur else 0,
        "totalActions": int(cur["actions"] or 0) if cur else 0,
        "frustratedSessions": int(cur["frustrated_sessions"] or 0) if cur else 0,
        "viewsChangePct": round(pct, 2),
        "fromMs": int(frm.timestamp() * 1000),
        "toMs": int(to.timestamp() * 1000),
    }


@router.get("/applications/{app_id}/series")
async def application_series(
    app_id: str,
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    metric: str = Query(default="loadingTime"),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Time series for the page-performance hero chart on the Summary tab.

    `metric` is one of: loadingTime | lcp | fcp | cls | inp | views.
    Returns a list of {ts, p50, p75, p90} for latency metrics; for `views`
    returns {ts, count}. Includes a parallel previous-window series so the UI
    can draw the dotted "previous" line shown in the screenshot.
    """
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    frm, to = _from_to_or_default(fromMs, toMs)
    bucket = _bucket_for((to - frm).total_seconds())
    prev_frm = frm - (to - frm)
    prev_to = frm

    column_map = {
        "loadingTime": "loading_time_ms",
        "lcp": "lcp_ms",
        "fcp": "fcp_ms",
        "inp": "inp_ms",
        "cls": "cls",
    }

    pool = await get_pool()
    async with pool.acquire() as conn:
        if metric == "views":
            cur = await conn.fetch(
                f"""
                SELECT time_bucket('{bucket}', ts) AS ts,
                       COUNT(*) AS count
                FROM rum_events
                WHERE application_id = $1 AND event_type = 'view'
                  AND ts >= $2 AND ts < $3
                GROUP BY 1 ORDER BY 1
                """,
                app_id, frm, to,
            )
            prev = await conn.fetch(
                f"""
                SELECT time_bucket('{bucket}', ts) AS ts,
                       COUNT(*) AS count
                FROM rum_events
                WHERE application_id = $1 AND event_type = 'view'
                  AND ts >= $2 AND ts < $3
                GROUP BY 1 ORDER BY 1
                """,
                app_id, prev_frm, prev_to,
            )
            return {
                "metric": metric,
                "current": [
                    {"ts": int(r["ts"].timestamp() * 1000), "count": int(r["count"])}
                    for r in cur
                ],
                "previous": [
                    {"ts": int(r["ts"].timestamp() * 1000), "count": int(r["count"])}
                    for r in prev
                ],
            }

        col = column_map.get(metric, "loading_time_ms")
        cur = await conn.fetch(
            f"""
            SELECT time_bucket('{bucket}', ts) AS ts,
                   percentile_cont(0.50) WITHIN GROUP (ORDER BY {col}) AS p50,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY {col}) AS p75,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY {col}) AS p95
            FROM rum_events
            WHERE application_id = $1 AND event_type = 'view'
              AND {col} IS NOT NULL
              AND ts >= $2 AND ts < $3
            GROUP BY 1 ORDER BY 1
            """,
            app_id, frm, to,
        )
        prev = await conn.fetch(
            f"""
            SELECT time_bucket('{bucket}', ts) AS ts,
                   percentile_cont(0.50) WITHIN GROUP (ORDER BY {col}) AS p50,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY {col}) AS p95
            FROM rum_events
            WHERE application_id = $1 AND event_type = 'view'
              AND {col} IS NOT NULL
              AND ts >= $2 AND ts < $3
            GROUP BY 1 ORDER BY 1
            """,
            app_id, prev_frm, prev_to,
        )
    return {
        "metric": metric,
        "current": [
            {
                "ts": int(r["ts"].timestamp() * 1000),
                "p50": float(r["p50"] or 0),
                "p75": float(r["p75"] or 0),
                "p95": float(r["p95"] or 0),
            }
            for r in cur
        ],
        "previous": [
            {
                "ts": int(r["ts"].timestamp() * 1000),
                "p50": float(r["p50"] or 0),
                "p95": float(r["p95"] or 0),
            }
            for r in prev
        ],
    }


@router.get("/applications/{app_id}/vitals")
async def application_vitals(
    app_id: str,
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Five core web vitals — drives the small sparkline cards on the Summary
    page (Loading Time / LCP / FCP / CLS / INP).
    """
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    frm, to = _from_to_or_default(fromMs, toMs)
    bucket = _bucket_for((to - frm).total_seconds())

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT time_bucket('{bucket}', ts) AS ts,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY loading_time_ms) AS loading_time,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY lcp_ms) AS lcp,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY fcp_ms) AS fcp,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY inp_ms) AS inp,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY cls) AS cls
            FROM rum_events
            WHERE application_id = $1 AND event_type = 'view'
              AND ts >= $2 AND ts < $3
            GROUP BY 1 ORDER BY 1
            """,
            app_id, frm, to,
        )
        agg = await conn.fetchrow(
            """
            SELECT
              percentile_cont(0.75) WITHIN GROUP (ORDER BY loading_time_ms) AS loading_time,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY lcp_ms) AS lcp,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY fcp_ms) AS fcp,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY inp_ms) AS inp,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY cls) AS cls
            FROM rum_events
            WHERE application_id = $1 AND event_type = 'view'
              AND ts >= $2 AND ts < $3
            """,
            app_id, frm, to,
        )

    def serialise(metric_key: str) -> list[dict]:
        return [
            {"ts": int(r["ts"].timestamp() * 1000), "value": float(r[metric_key] or 0)}
            for r in rows
        ]

    return {
        "loadingTime": {
            "p75": float(agg["loading_time"] or 0) if agg else 0,
            "series": serialise("loading_time"),
        },
        "lcp": {
            "p75": float(agg["lcp"] or 0) if agg else 0,
            "series": serialise("lcp"),
        },
        "fcp": {
            "p75": float(agg["fcp"] or 0) if agg else 0,
            "series": serialise("fcp"),
        },
        "cls": {
            "p75": float(agg["cls"] or 0) if agg else 0,
            "series": serialise("cls"),
        },
        "inp": {
            "p75": float(agg["inp"] or 0) if agg else 0,
            "series": serialise("inp"),
        },
    }


@router.get("/applications/{app_id}/error-rate")
async def application_error_rate(
    app_id: str,
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """% of views that contained at least one error. Drives the Frontend
    Errors card."""
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    frm, to = _from_to_or_default(fromMs, toMs)
    bucket = _bucket_for((to - frm).total_seconds())

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            WITH per_view AS (
              SELECT view_id,
                     time_bucket('{bucket}', MIN(ts)) AS bucket,
                     bool_or(event_type = 'error') AS has_error
              FROM rum_events
              WHERE application_id = $1 AND ts >= $2 AND ts < $3
              GROUP BY view_id
            )
            SELECT bucket AS ts,
                   COUNT(*) AS views,
                   COUNT(*) FILTER (WHERE has_error) AS error_views
            FROM per_view
            WHERE bucket IS NOT NULL
            GROUP BY 1 ORDER BY 1
            """,
            app_id, frm, to,
        )
        agg = await conn.fetchrow(
            """
            WITH per_view AS (
              SELECT view_id, bool_or(event_type = 'error') AS has_error
              FROM rum_events
              WHERE application_id = $1 AND ts >= $2 AND ts < $3
              GROUP BY view_id
            )
            SELECT COUNT(*) AS views, COUNT(*) FILTER (WHERE has_error) AS error_views
            FROM per_view
            """,
            app_id, frm, to,
        )
    out_series: list[dict] = []
    for r in rows:
        v = int(r["views"] or 0)
        e = int(r["error_views"] or 0)
        rate = (e / v * 100.0) if v else 0.0
        out_series.append({
            "ts": int(r["ts"].timestamp() * 1000),
            "errorRate": round(rate, 2),
            "views": v,
            "errorViews": e,
        })
    total_v = int(agg["views"] or 0) if agg else 0
    total_e = int(agg["error_views"] or 0) if agg else 0
    overall = (total_e / total_v * 100.0) if total_v else 0.0
    return {"errorRate": round(overall, 2), "views": total_v, "errorViews": total_e, "series": out_series}


@router.get("/applications/{app_id}/deployments")
async def application_deployments(
    app_id: str,
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Versions seen in RUM, with session counts. Backs the Track Deployments
    table."""
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT version, service,
                   COUNT(DISTINCT session_id) AS sessions,
                   COUNT(*) FILTER (WHERE event_type = 'error') AS errors
            FROM rum_events
            WHERE application_id = $1
              AND ts >= NOW() - INTERVAL '1 day'
            GROUP BY version, service
            ORDER BY sessions DESC
            """,
            app_id,
        )
    return [
        {
            "service": r["service"],
            "version": r["version"],
            "sessions": int(r["sessions"] or 0),
            "errors": int(r["errors"] or 0),
            "webVitalsP75Warnings": 0,
        }
        for r in rows
    ]


@router.get("/applications/{app_id}/resource-performance")
async def application_resource_performance(
    app_id: str,
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Slowest resource endpoints. Backs the Improve Resource Performance
    table on the Summary page."""
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    frm, to = _from_to_or_default(fromMs, toMs)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT resource_url, resource_method,
                   COUNT(*) AS hits,
                   percentile_cont(0.50) WITHIN GROUP (ORDER BY resource_duration_ms) AS p50,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY resource_duration_ms) AS p95,
                   COUNT(*) FILTER (WHERE resource_status >= 400) AS errors
            FROM rum_events
            WHERE application_id = $1 AND event_type = 'resource'
              AND ts >= $2 AND ts < $3
            GROUP BY resource_url, resource_method
            ORDER BY p95 DESC
            LIMIT $4
            """,
            app_id, frm, to, limit,
        )
    return [
        {
            "url": r["resource_url"],
            "method": r["resource_method"],
            "hits": int(r["hits"] or 0),
            "p50LatencyMs": float(r["p50"] or 0),
            "p95LatencyMs": float(r["p95"] or 0),
            "errors": int(r["errors"] or 0),
        }
        for r in rows
    ]


@router.get("/applications/{app_id}/top-views")
async def application_top_views(
    app_id: str,
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    if app_by_id(app_id) is None:
        raise HTTPException(404, "Application not found")
    frm, to = _from_to_or_default(fromMs, toMs)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT view_path,
                   COUNT(*) AS views,
                   COUNT(DISTINCT session_id) AS sessions,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY loading_time_ms) AS loading_p75,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY lcp_ms) AS lcp_p75
            FROM rum_events
            WHERE application_id = $1 AND event_type = 'view'
              AND ts >= $2 AND ts < $3 AND view_path IS NOT NULL
            GROUP BY view_path
            ORDER BY views DESC
            LIMIT $4
            """,
            app_id, frm, to, limit,
        )
    return [
        {
            "path": r["view_path"],
            "views": int(r["views"] or 0),
            "sessions": int(r["sessions"] or 0),
            "loadingTimeP75Ms": float(r["loading_p75"] or 0),
            "lcpP75Ms": float(r["lcp_p75"] or 0),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Sessions (Session Replay search + detail)
# ---------------------------------------------------------------------------


@router.get("/sessions")
async def list_sessions(
    appId: str | None = Query(default=None),
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    minViews: int | None = Query(default=None),
    minActions: int | None = Query(default=None),
    minErrors: int | None = Query(default=None),
    minTimeSpentSeconds: int | None = Query(default=None),
    minFrustrations: int | None = Query(default=None),
    country: str | None = Query(default=None),
    browser: str | None = Query(default=None),
    device: str | None = Query(default=None),
    hasError: bool | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    frm, to = _from_to_or_default(fromMs, toMs)
    where = ["s.event_type = 'session_summary'", "s.ts >= $1", "s.ts < $2"]
    params: list[Any] = [frm, to]

    def add(clause: str, value: Any) -> None:
        params.append(value)
        where.append(clause.replace("?", f"${len(params)}"))

    if appId:
        add("s.application_id = ?", appId)
    if minViews is not None:
        add("s.session_view_count >= ?", minViews)
    if minActions is not None:
        add("s.session_action_count >= ?", minActions)
    if minErrors is not None:
        add("s.session_error_count >= ?", minErrors)
    if minFrustrations is not None:
        add("s.session_frustration_count >= ?", minFrustrations)
    if minTimeSpentSeconds is not None:
        add("s.session_time_spent_ms >= ?", minTimeSpentSeconds * 1000)
    if country:
        add("s.geo_country = ?", country)
    if browser:
        add("s.browser_name = ?", browser)
    if device:
        add("s.device_type = ?", device)
    if hasError is True:
        where.append("s.session_error_count > 0")
    elif hasError is False:
        where.append("(s.session_error_count IS NULL OR s.session_error_count = 0)")

    params.append(limit)
    sql = f"""
        SELECT s.session_id, s.application_id, s.user_id, s.user_name, s.user_email,
               s.geo_country, s.geo_city, s.browser_name, s.browser_version,
               s.os_name, s.device_type, s.version,
               s.session_view_count, s.session_action_count,
               s.session_error_count, s.session_frustration_count,
               s.session_time_spent_ms, s.view_path AS final_path,
               s.view_referrer AS referrer, s.ts AS ended_at,
               (SELECT MIN(ts) FROM rum_events WHERE session_id = s.session_id) AS started_at,
               (SELECT view_path FROM rum_events
                WHERE session_id = s.session_id AND event_type = 'view'
                ORDER BY ts ASC LIMIT 1) AS entry_path
        FROM rum_events s
        WHERE {' AND '.join(where)}
        ORDER BY s.ts DESC
        LIMIT ${len(params)}
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    return [
        {
            "id": r["session_id"],
            "applicationId": r["application_id"],
            "userId": r["user_id"],
            "userName": r["user_name"],
            "userEmail": r["user_email"],
            "country": r["geo_country"],
            "city": r["geo_city"],
            "browser": r["browser_name"],
            "browserVersion": r["browser_version"],
            "os": r["os_name"],
            "deviceType": r["device_type"],
            "version": r["version"],
            "viewCount": int(r["session_view_count"] or 0),
            "actionCount": int(r["session_action_count"] or 0),
            "errorCount": int(r["session_error_count"] or 0),
            "frustrationCount": int(r["session_frustration_count"] or 0),
            "timeSpentMs": int(r["session_time_spent_ms"] or 0),
            "entryPath": r["entry_path"],
            "finalPath": r["final_path"],
            "referrer": r["referrer"],
            "startedAtMs": int(r["started_at"].timestamp() * 1000) if r["started_at"] else None,
            "endedAtMs": int(r["ended_at"].timestamp() * 1000) if r["ended_at"] else None,
        }
        for r in rows
    ]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Full session, with event timeline. Powers the Session Replay player —
    we don't ship real DOM recordings, just a structured event timeline the
    UI animates as a video-like player."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        events = await conn.fetch(
            """
            SELECT ts, event_type, view_id, view_path, view_url, view_referrer,
                   loading_time_ms, lcp_ms, fcp_ms, inp_ms, cls, time_spent_ms,
                   action_type, action_name,
                   error_message, error_source, error_stack,
                   resource_url, resource_method, resource_status,
                   resource_duration_ms, long_task_duration_ms,
                   user_id, user_name, user_email,
                   browser_name, browser_version, os_name, device_type,
                   geo_country, geo_city, version, application_id, attributes
            FROM rum_events
            WHERE session_id = $1
            ORDER BY ts ASC
            """,
            session_id,
        )
    if not events:
        raise HTTPException(404, "Session not found")

    summary_row = next((e for e in events if e["event_type"] == "session_summary"), None)
    first_view = next((e for e in events if e["event_type"] == "view"), None)
    started_ms = int(events[0]["ts"].timestamp() * 1000)
    ended_ms = int(events[-1]["ts"].timestamp() * 1000)

    timeline = []
    for e in events:
        if e["event_type"] == "session_summary":
            continue
        attrs = (
            json.loads(e["attributes"])
            if isinstance(e["attributes"], str)
            else (e["attributes"] or {})
        )
        item: dict[str, Any] = {
            "ts": int(e["ts"].timestamp() * 1000),
            "tOffsetMs": int(e["ts"].timestamp() * 1000) - started_ms,
            "type": e["event_type"],
            "viewId": e["view_id"],
            "viewPath": e["view_path"],
            "attributes": attrs,
        }
        if e["event_type"] == "view":
            item.update({
                "viewUrl": e["view_url"],
                "viewReferrer": e["view_referrer"],
                "loadingTimeMs": e["loading_time_ms"],
                "lcpMs": e["lcp_ms"],
                "fcpMs": e["fcp_ms"],
                "inpMs": e["inp_ms"],
                "cls": float(e["cls"]) if e["cls"] is not None else None,
                "timeSpentMs": e["time_spent_ms"],
            })
        elif e["event_type"] == "action":
            item.update({
                "actionType": e["action_type"],
                "actionName": e["action_name"],
            })
        elif e["event_type"] == "error":
            item.update({
                "errorMessage": e["error_message"],
                "errorSource": e["error_source"],
                "errorStack": e["error_stack"],
            })
        elif e["event_type"] == "resource":
            item.update({
                "resourceUrl": e["resource_url"],
                "resourceMethod": e["resource_method"],
                "resourceStatus": e["resource_status"],
                "resourceDurationMs": e["resource_duration_ms"],
            })
        elif e["event_type"] == "long_task":
            item["longTaskDurationMs"] = e["long_task_duration_ms"]
        timeline.append(item)

    head = first_view if first_view is not None else events[0]

    return {
        "id": session_id,
        "applicationId": head["application_id"],
        "userId": head["user_id"],
        "userName": head["user_name"],
        "userEmail": head["user_email"],
        "country": head["geo_country"],
        "city": head["geo_city"],
        "browser": head["browser_name"],
        "browserVersion": head["browser_version"],
        "os": head["os_name"],
        "deviceType": head["device_type"],
        "version": head["version"],
        "startedAtMs": started_ms,
        "endedAtMs": ended_ms,
        "durationMs": ended_ms - started_ms,
        "viewCount": int(summary_row["session_view_count"] or 0) if summary_row else 0,
        "actionCount": int(summary_row["session_action_count"] or 0) if summary_row else 0,
        "errorCount": int(summary_row["session_error_count"] or 0) if summary_row else 0,
        "frustrationCount": int(summary_row["session_frustration_count"] or 0) if summary_row else 0,
        "timeSpentMs": int(summary_row["session_time_spent_ms"] or 0) if summary_row else 0,
        "timeline": timeline,
    }


# ---------------------------------------------------------------------------
# Errors / explorer
# ---------------------------------------------------------------------------


@router.get("/errors")
async def list_errors(
    appId: str | None = Query(default=None),
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    frm, to = _from_to_or_default(fromMs, toMs)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT error_message, error_source,
                   COUNT(*) AS occurrences,
                   COUNT(DISTINCT session_id) AS impacted_sessions,
                   MIN(ts) AS first_seen,
                   MAX(ts) AS last_seen,
                   array_agg(DISTINCT view_path) FILTER (WHERE view_path IS NOT NULL) AS paths,
                   array_agg(DISTINCT browser_name) FILTER (WHERE browser_name IS NOT NULL) AS browsers
            FROM rum_events
            WHERE event_type = 'error' AND ts >= $1 AND ts < $2
              AND ($3::text IS NULL OR application_id = $3)
            GROUP BY error_message, error_source
            ORDER BY occurrences DESC
            LIMIT $4
            """,
            frm, to, appId, limit,
        )
    return [
        {
            "message": r["error_message"],
            "source": r["error_source"],
            "occurrences": int(r["occurrences"] or 0),
            "impactedSessions": int(r["impacted_sessions"] or 0),
            "firstSeenMs": int(r["first_seen"].timestamp() * 1000) if r["first_seen"] else None,
            "lastSeenMs": int(r["last_seen"].timestamp() * 1000) if r["last_seen"] else None,
            "paths": list(r["paths"] or []),
            "browsers": list(r["browsers"] or []),
        }
        for r in rows
    ]


@router.get("/views")
async def list_views(
    appId: str | None = Query(default=None),
    fromMs: int | None = Query(default=None),
    toMs: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Recent individual view events. Powers the Explorer tab list."""
    frm, to = _from_to_or_default(fromMs, toMs)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ts, application_id, session_id, view_id, view_path, view_url,
                   loading_time_ms, lcp_ms, fcp_ms, inp_ms, cls, time_spent_ms,
                   user_id, user_name, browser_name, os_name, device_type,
                   geo_country, version
            FROM rum_events
            WHERE event_type = 'view' AND ts >= $1 AND ts < $2
              AND ($3::text IS NULL OR application_id = $3)
            ORDER BY ts DESC
            LIMIT $4
            """,
            frm, to, appId, limit,
        )
    return [
        {
            "ts": int(r["ts"].timestamp() * 1000),
            "applicationId": r["application_id"],
            "sessionId": r["session_id"],
            "viewId": r["view_id"],
            "viewPath": r["view_path"],
            "viewUrl": r["view_url"],
            "loadingTimeMs": r["loading_time_ms"],
            "lcpMs": r["lcp_ms"],
            "fcpMs": r["fcp_ms"],
            "inpMs": r["inp_ms"],
            "cls": float(r["cls"]) if r["cls"] is not None else None,
            "timeSpentMs": r["time_spent_ms"],
            "userId": r["user_id"],
            "userName": r["user_name"],
            "browser": r["browser_name"],
            "os": r["os_name"],
            "deviceType": r["device_type"],
            "country": r["geo_country"],
            "version": r["version"],
        }
        for r in rows
    ]
