"""Seed CI pipelines, 7 days of executions, jobs, test runs, and TIA stats."""

from __future__ import annotations

import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.telemetry.pool import get_pool
from app.telemetry.topology import SERVICES


logger = logging.getLogger(__name__)


_PIPELINES_PER_SERVICE = [
    ("ci", "team:platform"),
    ("nightly", "team:platform"),
]

_BRANCHES = ["main", "develop", "release/v3.2", "feature/payments-cleanup",
             "feature/auth-rotation", "fix/redis-failover"]
_AUTHORS = [
    "vedanta@example.com",
    "priya@example.com",
    "marcus@example.com",
    "aisha@example.com",
    "diego@example.com",
]

_ERROR_DOMAINS = ["test_failure", "build_error", "timeout", "infra"]
_TRIGGER_TYPES = ["push", "pr", "manual", "schedule"]

_TEST_SUITES = {
    "web": ["unit", "integration", "e2e"],
    "api": ["unit", "integration", "contract"],
    "auth": ["unit", "integration", "security"],
    "payments": ["unit", "integration", "compliance"],
    "worker": ["unit", "integration"],
    "caddy": ["smoke"],
    "postgres": ["migration"],
    "redis": ["smoke"],
}

_STAGE_TEMPLATE = ["build", "test", "deploy"]
_JOBS_PER_STAGE = {
    "build": ["compile", "package"],
    "test": ["unit", "integration", "lint"],
    "deploy": ["staging", "smoke"],
}


def _random_sha() -> str:
    return uuid.uuid4().hex[:7]


def _pick_status() -> str:
    return random.choices(
        ["success", "failure", "canceled"], weights=[0.8, 0.15, 0.05]
    )[0]


async def has_any_pipelines() -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM ci_pipelines LIMIT 1")
    return row is not None


async def seed_if_empty() -> tuple[int, int]:
    if await has_any_pipelines():
        return 0, 0
    pool = await get_pool()
    pipelines: list[tuple[uuid.UUID, str]] = []  # (id, service)
    async with pool.acquire() as conn:
        for svc in SERVICES:
            for suffix, team_tag in _PIPELINES_PER_SERVICE:
                pid = uuid.uuid4()
                pipelines.append((pid, svc.name))
                await conn.execute(
                    """
                    INSERT INTO ci_pipelines
                        (id, name, repo, default_branch, service, team, avg_duration_ms)
                    VALUES ($1, $2, $3, 'main', $4, $5, $6)
                    """,
                    pid, f"{svc.name}-{suffix}",
                    f"acmecorp/{svc.name}", svc.name, svc.team,
                    random.randint(120_000, 480_000),
                )

        now = datetime.now(timezone.utc)
        execution_count = 0
        # Daily: ~50 executions/day across all services for 7 days
        for day_offset in range(7, -1, -1):
            day_anchor = now - timedelta(days=day_offset)
            for _ in range(random.randint(45, 60)):
                pid, service = random.choice(pipelines)
                started = day_anchor - timedelta(
                    minutes=random.randint(0, 23 * 60),
                )
                duration_s = random.randint(120, 480)
                status = _pick_status()
                error_domain = random.choice(_ERROR_DOMAINS) if status == "failure" else None
                exec_id = uuid.uuid4()
                await conn.execute(
                    """
                    INSERT INTO ci_pipeline_executions
                        (id, pipeline_id, commit_sha, branch, status, triggered_by,
                         trigger_type, duration_ms, queue_time_ms, started_at,
                         finished_at, error_domain)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                    exec_id, pid, _random_sha(),
                    random.choice(_BRANCHES), status,
                    random.choice(_AUTHORS),
                    random.choices(_TRIGGER_TYPES, weights=[0.6, 0.3, 0.05, 0.05])[0],
                    duration_s * 1000,
                    random.randint(2_000, 30_000),
                    started, started + timedelta(seconds=duration_s),
                    error_domain,
                )

                # Build job tree
                stage_offset = 0
                for stage_name in _STAGE_TEMPLATE:
                    stage_duration = duration_s // 3 + random.randint(-15, 15)
                    stage_id = uuid.uuid4()
                    stage_status = (
                        "failure"
                        if status == "failure" and stage_name == "test" and random.random() < 0.7
                        else status if stage_name == "deploy" and status != "success" else "success"
                    )
                    stage_started = started + timedelta(seconds=stage_offset)
                    await conn.execute(
                        """
                        INSERT INTO ci_jobs
                            (id, execution_id, parent_job_id, name, kind, status,
                             duration_ms, started_at, finished_at, logs_excerpt)
                        VALUES ($1, $2, NULL, $3, 'stage', $4, $5, $6, $7, $8)
                        """,
                        stage_id, exec_id, stage_name,
                        stage_status, stage_duration * 1000,
                        stage_started, stage_started + timedelta(seconds=stage_duration),
                        f"Stage {stage_name} ran for {stage_duration}s.",
                    )
                    job_offset = 0
                    for job_name in _JOBS_PER_STAGE[stage_name]:
                        job_dur = stage_duration // len(_JOBS_PER_STAGE[stage_name])
                        job_status = stage_status if job_name == "integration" and stage_status == "failure" else (
                            "success" if stage_status == "success" else random.choice(["success", stage_status])
                        )
                        job_started = stage_started + timedelta(seconds=job_offset)
                        await conn.execute(
                            """
                            INSERT INTO ci_jobs
                                (id, execution_id, parent_job_id, name, kind, status,
                                 duration_ms, started_at, finished_at, logs_excerpt)
                            VALUES ($1, $2, $3, $4, 'job', $5, $6, $7, $8, $9)
                            """,
                            uuid.uuid4(), exec_id, stage_id, f"{stage_name}.{job_name}",
                            job_status, job_dur * 1000,
                            job_started, job_started + timedelta(seconds=job_dur),
                            f"Job {job_name} (subset of {stage_name})",
                        )
                        job_offset += job_dur
                    stage_offset += stage_duration

                # Tests for this execution (only if test stage ran)
                num_tests = random.randint(50, 180)
                suites = _TEST_SUITES.get(service, ["smoke"])
                for i in range(num_tests):
                    suite = random.choice(suites)
                    if status == "failure" and i < 3:
                        test_status = "failed"
                        err = "AssertionError: expected 200, got 500"
                        skip_reason = None
                    elif random.random() < 0.5:
                        test_status = "skipped"
                        err = None
                        skip_reason = random.choice([
                            "no_changes_detected",
                            "covered_by_other",
                        ])
                    elif random.random() < 0.04:
                        test_status = "flaky"
                        err = "Intermittent timeout"
                        skip_reason = None
                    else:
                        test_status = "passed"
                        err = None
                        skip_reason = None
                    await conn.execute(
                        """
                        INSERT INTO ci_test_runs
                            (id, execution_id, suite, test_name, status, duration_ms,
                             retry_count, error_message, skipped_reason)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        """,
                        uuid.uuid4(), exec_id, suite, f"test_{i:03d}_{suite}",
                        test_status, random.randint(50, 4_500),
                        2 if test_status == "flaky" else 0,
                        err, skip_reason,
                    )
                execution_count += 1

        # Daily TIA stats
        for day_offset in range(14, -1, -1):
            day = (now - timedelta(days=day_offset)).date()
            for svc in SERVICES:
                total = random.randint(800, 2400)
                skipped = int(total * random.uniform(0.3, 0.62))
                saved_ms = skipped * random.randint(120, 1800)
                await conn.execute(
                    """
                    INSERT INTO ci_test_impact_stats
                        (day, service, total_tests, skipped_by_itr, time_saved_ms)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (day, service) DO NOTHING
                    """,
                    day, svc.name, total, skipped, saved_ms,
                )

    logger.info("ci.seed: pipelines=%d executions=%d", len(pipelines), execution_count)
    return len(pipelines), execution_count
