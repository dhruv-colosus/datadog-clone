"""Seed historical Watchdog stories so /watchdog isn't empty on first boot."""

from __future__ import annotations

import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.telemetry.pool import get_pool


logger = logging.getLogger(__name__)


_TEMPLATES: list[dict[str, Any]] = [
    {
        "kind": "anomaly",
        "service": "api",
        "metric": "api.request_latency_ms",
        "title": "Anomalous request latency on api",
        "narrative": (
            "api.request_latency_ms is anomalously high — currently 312 ms vs. "
            "baseline 145 ms (3.2σ deviation). Watchdog identified this pattern "
            "from the last 30 minutes of telemetry."
        ),
        "severity": "high",
        "evidence_baseline": 145,
        "evidence_value": 312,
    },
    {
        "kind": "anomaly",
        "service": "payments",
        "metric": "payments.error_count",
        "title": "Anomalous error rate on payments",
        "narrative": (
            "payments.error_count spike: 18.7 errors/min vs. baseline 2.4 errors/min "
            "(4.1σ deviation). This pattern correlates with elevated 5xx responses "
            "from the upstream payment processor."
        ),
        "severity": "high",
        "evidence_baseline": 2.4,
        "evidence_value": 18.7,
    },
    {
        "kind": "deployment_regression",
        "service": "web",
        "metric": "web.request_latency_ms",
        "title": "Latency regression after web v2.4.1 deploy",
        "narrative": (
            "Following the v2.4.1 deployment 2h ago, web p95 latency increased by "
            "37%. This regression appears across all environments and persists "
            "after rollback would have completed."
        ),
        "severity": "medium",
        "evidence_baseline": 220,
        "evidence_value": 302,
    },
    {
        "kind": "anomaly",
        "service": "postgres",
        "metric": "postgresql.percent_usage_connections",
        "title": "Anomalous connection-pool utilization",
        "narrative": (
            "Postgres connection-pool utilization climbed to 78% over the last "
            "10 minutes (baseline 32%). Long-running transactions appear to be "
            "holding connections."
        ),
        "severity": "medium",
        "evidence_baseline": 32,
        "evidence_value": 78,
    },
    {
        "kind": "outlier",
        "service": "worker",
        "metric": "worker.queue_depth",
        "title": "Outlier worker host: worker-2",
        "narrative": (
            "worker-2 has a queue depth of 412 jobs — substantially higher than "
            "its peers (median 38). One worker appears to be lagging the pool."
        ),
        "severity": "low",
        "evidence_baseline": 38,
        "evidence_value": 412,
    },
    {
        "kind": "anomaly",
        "service": "redis",
        "metric": "redis.commands.processed",
        "title": "Anomalous drop in Redis throughput",
        "narrative": (
            "redis.commands.processed dropped to 1.2k cmd/s — 68% below the "
            "rolling baseline of 3.7k cmd/s. Either traffic shifted off Redis "
            "or an upstream client is failing."
        ),
        "severity": "medium",
        "evidence_baseline": 3700,
        "evidence_value": 1200,
    },
    {
        "kind": "anomaly",
        "service": "auth",
        "metric": "auth.failed_logins",
        "title": "Spike in failed login attempts",
        "narrative": (
            "auth service is recording 84 failed logins/min — a 6.2σ deviation "
            "from baseline. This may indicate a credential-stuffing attack or "
            "a broken client SDK."
        ),
        "severity": "high",
        "evidence_baseline": 4,
        "evidence_value": 84,
    },
    {
        "kind": "deviation",
        "service": "caddy",
        "metric": "caddy.status_codes",
        "title": "5xx ratio above expected",
        "narrative": (
            "Caddy reverse proxy is returning a higher proportion of 5xx codes "
            "than its 7-day historical baseline. The deviation is concentrated "
            "in the /api/* path family."
        ),
        "severity": "low",
        "evidence_baseline": 0.4,
        "evidence_value": 1.7,
    },
    {
        "kind": "anomaly",
        "service": "api",
        "metric": "api.request_count",
        "title": "Traffic anomaly on api",
        "narrative": (
            "api.request_count is below its expected band — possibly due to a "
            "client misconfiguration or upstream LB drop."
        ),
        "severity": "low",
        "evidence_baseline": 1850,
        "evidence_value": 1090,
    },
    {
        "kind": "outlier",
        "service": "web",
        "metric": "web.cpu_usage",
        "title": "Outlier host CPU on web-3",
        "narrative": (
            "web-3 is consuming 87% CPU — 3.4σ above peer fleet (median 41%). "
            "A noisy neighbor or runaway process is the likely cause."
        ),
        "severity": "medium",
        "evidence_baseline": 41,
        "evidence_value": 87,
    },
    {
        "kind": "anomaly",
        "service": "payments",
        "metric": "payments.processed_amount_usd",
        "title": "Drop in processed payment volume",
        "narrative": (
            "payments.processed_amount_usd dropped 42% versus the prior 7-day "
            "baseline. This may indicate a checkout regression or upstream "
            "processor degradation."
        ),
        "severity": "high",
        "evidence_baseline": 84200,
        "evidence_value": 48700,
    },
    {
        "kind": "anomaly",
        "service": "worker",
        "metric": "worker.job_failures",
        "title": "Worker job-failure spike",
        "narrative": (
            "worker.job_failures elevated to 23/min over the last 10 minutes "
            "(baseline 2/min). Multiple job classes affected, suggesting a "
            "shared dependency issue."
        ),
        "severity": "medium",
        "evidence_baseline": 2,
        "evidence_value": 23,
    },
]


def _synthesize_points(baseline: float, value: float) -> list[dict[str, Any]]:
    """Produce 30 synthetic chart points trending toward the anomalous value."""
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    points: list[dict[str, Any]] = []
    for i in range(30):
        progress = i / 29.0
        # last 6 points trend toward the value; rest cluster around baseline
        if i < 24:
            base = baseline + random.uniform(-baseline * 0.1, baseline * 0.1)
        else:
            ramp = (i - 24) / 6.0
            base = baseline + (value - baseline) * (ramp ** 1.5)
            base += random.uniform(-baseline * 0.05, baseline * 0.05)
        ts = now_ms - (29 - i) * 60_000
        points.append({"ts": ts, "value": round(base, 2)})
    return points


async def has_any_stories() -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM watchdog_stories LIMIT 1")
    return row is not None


async def seed_if_empty() -> int:
    if await has_any_stories():
        return 0
    pool = await get_pool()
    inserted = 0
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        for i, t in enumerate(_TEMPLATES):
            started = now - timedelta(minutes=random.randint(5, 60 * 24 * 6))
            status = random.choices(
                ["active", "acknowledged", "resolved"],
                weights=[0.5, 0.2, 0.3],
            )[0]
            ended = (
                started + timedelta(minutes=random.randint(15, 120))
                if status == "resolved"
                else None
            )
            evidence = {
                "points": _synthesize_points(
                    t["evidence_baseline"], t["evidence_value"],
                ),
                "baseline": t["evidence_baseline"],
                "currentValue": t["evidence_value"],
                "upper": t["evidence_baseline"] * 1.3,
                "lower": t["evidence_baseline"] * 0.7,
                "sigmas": 3.0 + random.random() * 2,
            }
            await conn.execute(
                """
                INSERT INTO watchdog_stories
                    (id, kind, title, narrative, severity, status, service,
                     metric, evidence, started_at, ended_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
                """,
                uuid.uuid4(),
                t["kind"],
                t["title"],
                t["narrative"],
                t["severity"],
                status,
                t["service"],
                t["metric"],
                json.dumps(evidence),
                started,
                ended,
            )
            inserted += 1
    logger.info("watchdog.seed: inserted %d stories", inserted)
    return inserted
