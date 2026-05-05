"""CI Visibility — pipelines, executions, jobs, test runs, TIA stats."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User


router = APIRouter(prefix="/ci", tags=["ci"])


def _pipeline_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "name": row.name,
        "repo": row.repo,
        "defaultBranch": row.default_branch,
        "service": row.service,
        "team": row.team,
        "avgDurationMs": row.avg_duration_ms,
        "createdMs": int(row.created_at.timestamp() * 1000),
    }


def _execution_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "pipelineId": str(row.pipeline_id),
        "pipelineName": getattr(row, "pipeline_name", None),
        "service": getattr(row, "service", None),
        "commitSha": row.commit_sha,
        "branch": row.branch,
        "status": row.status,
        "triggeredBy": row.triggered_by,
        "triggerType": row.trigger_type,
        "durationMs": row.duration_ms,
        "queueTimeMs": row.queue_time_ms,
        "startedMs": int(row.started_at.timestamp() * 1000),
        "finishedMs": (
            int(row.finished_at.timestamp() * 1000) if row.finished_at else None
        ),
        "errorDomain": row.error_domain,
    }


def _job_row(row) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "executionId": str(row.execution_id),
        "parentJobId": str(row.parent_job_id) if row.parent_job_id else None,
        "name": row.name,
        "kind": row.kind,
        "status": row.status,
        "durationMs": row.duration_ms,
        "startedMs": int(row.started_at.timestamp() * 1000),
        "finishedMs": (
            int(row.finished_at.timestamp() * 1000) if row.finished_at else None
        ),
        "logsExcerpt": row.logs_excerpt,
    }


@router.get("/pipelines")
async def list_pipelines(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    res = await db.execute(
        text(
            "SELECT id, name, repo, default_branch, service, team, "
            "avg_duration_ms, created_at FROM ci_pipelines ORDER BY name ASC"
        )
    )
    return [_pipeline_row(r) for r in res]


@router.get("/pipeline-executions")
async def list_executions(
    pipeline_id: str | None = Query(default=None),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    branch: str | None = Query(default=None),
    service: list[str] | None = Query(default=None),
    error_domain: list[str] | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    sql = (
        "SELECT e.id, e.pipeline_id, e.commit_sha, e.branch, e.status, "
        "e.triggered_by, e.trigger_type, e.duration_ms, e.queue_time_ms, "
        "e.started_at, e.finished_at, e.error_domain, "
        "p.name AS pipeline_name, p.service "
        "FROM ci_pipeline_executions e "
        "JOIN ci_pipelines p ON p.id = e.pipeline_id"
    )
    where: list[str] = []
    params: dict[str, Any] = {}
    if pipeline_id:
        where.append("e.pipeline_id = :pid")
        params["pid"] = pipeline_id
    if status_filter:
        where.append("e.status = ANY(:statuses)")
        params["statuses"] = status_filter
    if branch:
        where.append("e.branch = :branch")
        params["branch"] = branch
    if service:
        where.append("p.service = ANY(:services)")
        params["services"] = service
    if error_domain:
        where.append("e.error_domain = ANY(:errors)")
        params["errors"] = error_domain
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY e.started_at DESC LIMIT :limit"
    params["limit"] = limit
    res = await db.execute(text(sql), params)
    return [_execution_row(r) for r in res]


@router.get("/pipeline-executions/{execution_id}")
async def get_execution(
    execution_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    res = await db.execute(
        text(
            "SELECT e.id, e.pipeline_id, e.commit_sha, e.branch, e.status, "
            "e.triggered_by, e.trigger_type, e.duration_ms, e.queue_time_ms, "
            "e.started_at, e.finished_at, e.error_domain, "
            "p.name AS pipeline_name, p.service "
            "FROM ci_pipeline_executions e "
            "JOIN ci_pipelines p ON p.id = e.pipeline_id "
            "WHERE e.id = :id"
        ),
        {"id": execution_id},
    )
    row = res.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    execution = _execution_row(row)

    job_res = await db.execute(
        text(
            "SELECT id, execution_id, parent_job_id, name, kind, status, "
            "duration_ms, started_at, finished_at, logs_excerpt "
            "FROM ci_jobs WHERE execution_id = :id ORDER BY started_at ASC"
        ),
        {"id": execution_id},
    )
    execution["jobs"] = [_job_row(j) for j in job_res]
    return execution


@router.get("/test-runs")
async def list_test_runs(
    execution_id: str | None = Query(default=None),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    limit: int = Query(default=200, ge=1, le=1000),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, execution_id, suite, test_name, status, duration_ms, "
        "retry_count, error_message, skipped_reason, created_at "
        "FROM ci_test_runs"
    )
    where: list[str] = []
    params: dict[str, Any] = {}
    if execution_id:
        where.append("execution_id = :eid")
        params["eid"] = execution_id
    if status_filter:
        where.append("status = ANY(:statuses)")
        params["statuses"] = status_filter
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit
    res = await db.execute(text(sql), params)
    return [
        {
            "id": str(r.id),
            "executionId": str(r.execution_id),
            "suite": r.suite,
            "testName": r.test_name,
            "status": r.status,
            "durationMs": r.duration_ms,
            "retryCount": r.retry_count,
            "errorMessage": r.error_message,
            "skippedReason": r.skipped_reason,
            "createdMs": int(r.created_at.timestamp() * 1000),
        }
        for r in res
    ]


@router.get("/test-services")
async def list_test_services(
    days: int = Query(default=14, ge=1, le=90),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=days)
    res = await db.execute(
        text(
            "SELECT service, "
            "SUM(total_tests) AS total, "
            "SUM(skipped_by_itr) AS skipped, "
            "SUM(time_saved_ms) AS saved "
            "FROM ci_test_impact_stats WHERE day >= :cutoff "
            "GROUP BY service ORDER BY service"
        ),
        {"cutoff": cutoff},
    )
    services = []
    for r in res:
        total = int(r.total or 0)
        skipped = int(r.skipped or 0)
        saved = int(r.saved or 0)
        services.append({
            "service": r.service,
            "totalTests": total,
            "skippedByItr": skipped,
            "skipRatePct": (skipped / total * 100) if total else 0.0,
            "timeSavedMs": saved,
        })

    # Per-day series
    daily_res = await db.execute(
        text(
            "SELECT day, service, total_tests, skipped_by_itr, time_saved_ms "
            "FROM ci_test_impact_stats WHERE day >= :cutoff ORDER BY day ASC"
        ),
        {"cutoff": cutoff},
    )
    daily: dict[str, list[dict[str, Any]]] = {}
    for r in daily_res:
        daily.setdefault(r.service, []).append({
            "day": r.day.isoformat(),
            "totalTests": r.total_tests,
            "skippedByItr": r.skipped_by_itr,
            "timeSavedMs": r.time_saved_ms,
        })
    for s in services:
        s["dailySeries"] = daily.get(s["service"], [])
    return services
