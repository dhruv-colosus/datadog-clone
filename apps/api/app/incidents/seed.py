"""Seed sample incidents so /incidents isn't empty on first boot."""

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
        "title": "Payments service degraded — checkout failures",
        "severity": "SEV-1",
        "summary": (
            "Customers experiencing checkout failures on the payments service. "
            "Error rate spiked to 18% over baseline of 0.4%."
        ),
        "customer_impact": "All checkout attempts failing for ~12 minutes.",
        "affected_services": ["payments", "web", "api"],
        "status": "resolved",
        "root_cause": "Upstream payment processor timeout after rate-limit change.",
        "resolved_offset_minutes": 27,
        "tasks": [
            ("Coordinate with payment processor support", "done"),
            ("Add fallback to secondary processor", "in_progress"),
            ("Add alerting on processor latency >2s", "open"),
        ],
        "postmortem": (
            "## Summary\nCheckout was unavailable for 12 minutes.\n\n"
            "## Impact\n~3,400 attempted checkouts failed.\n\n"
            "## Root Cause\nProcessor rate-limit change rejected requests.\n\n"
            "## Action Items\nSee incident tasks."
        ),
    },
    {
        "title": "API latency regression after v3.2.0 deploy",
        "severity": "SEV-2",
        "summary": "p95 latency on api jumped from 145ms to 320ms after deploy.",
        "customer_impact": "Slower page loads; no feature outage.",
        "affected_services": ["api", "web"],
        "status": "resolved",
        "root_cause": "N+1 query introduced in /v2/orders endpoint.",
        "resolved_offset_minutes": 95,
        "tasks": [
            ("Roll back v3.2.0", "done"),
            ("Author N+1 fix and validate locally", "done"),
            ("Add query-count assertion to integration tests", "open"),
        ],
        "postmortem": (
            "## Summary\nLatency regression after v3.2.0.\n\n"
            "## Root Cause\nN+1 in /v2/orders.\n\n## Action Items\nQuery-count tests."
        ),
    },
    {
        "title": "Auth: spike in failed logins",
        "severity": "SEV-2",
        "summary": "Failed login rate climbed to 84/min from baseline 4/min.",
        "customer_impact": "Possible credential-stuffing; no confirmed account takeover.",
        "affected_services": ["auth"],
        "status": "stable",
        "tasks": [
            ("Block suspicious IPs at edge", "done"),
            ("Confirm no successful breaches", "in_progress"),
            ("Notify security team", "done"),
        ],
    },
    {
        "title": "Postgres connection pool saturation",
        "severity": "SEV-3",
        "summary": "Pool utilization reached 89% during peak traffic.",
        "customer_impact": "Slight tail-latency increase; no errors.",
        "affected_services": ["postgres", "api"],
        "status": "resolved",
        "root_cause": "Long-running analytics query holding connections.",
        "resolved_offset_minutes": 18,
        "tasks": [
            ("Kill long-running query", "done"),
            ("Move analytics to read replica", "open"),
        ],
    },
    {
        "title": "Redis cluster failover",
        "severity": "SEV-2",
        "summary": "Primary Redis node failed over to replica during maintenance.",
        "customer_impact": "Brief 8s window of cache misses.",
        "affected_services": ["redis", "api", "auth"],
        "status": "completed",
        "root_cause": "Routine maintenance — expected behavior.",
        "resolved_offset_minutes": 4,
        "tasks": [
            ("Validate replica took over cleanly", "done"),
            ("Update on-call runbook", "done"),
        ],
        "postmortem": (
            "## Summary\nPlanned failover succeeded with 8s impact.\n\n"
            "## Action Items\nRunbook updated."
        ),
    },
    {
        "title": "Worker queue backup",
        "severity": "SEV-3",
        "summary": "Worker queue depth grew to 4.2k jobs.",
        "customer_impact": "Background jobs delayed by ~6 minutes.",
        "affected_services": ["worker"],
        "status": "active",
        "tasks": [
            ("Scale worker pool +5", "in_progress"),
            ("Identify slow job class", "open"),
        ],
    },
    {
        "title": "Caddy 5xx ratio elevated",
        "severity": "SEV-3",
        "summary": "5xx responses elevated to 1.8% from baseline 0.4%.",
        "customer_impact": "Some users seeing 502s on /api/* paths.",
        "affected_services": ["caddy", "api"],
        "status": "active",
        "tasks": [
            ("Check upstream health", "in_progress"),
        ],
    },
    {
        "title": "Web: high client-side JS errors",
        "severity": "SEV-4",
        "summary": "Sentry-equivalent showed spike in TypeError on checkout page.",
        "customer_impact": "Affected users on Safari 17.0 only.",
        "affected_services": ["web"],
        "status": "resolved",
        "resolved_offset_minutes": 145,
        "root_cause": "Third-party SDK incompatibility with Safari 17.0.",
        "tasks": [
            ("Pin SDK to last-known-good version", "done"),
        ],
    },
    {
        "title": "Disk pressure on postgres-1",
        "severity": "SEV-3",
        "summary": "Disk usage projected to cross 90% in 18h.",
        "customer_impact": "None yet — preventive incident.",
        "affected_services": ["postgres"],
        "status": "active",
        "tasks": [
            ("Vacuum largest tables", "in_progress"),
            ("Provision additional disk", "open"),
        ],
    },
    {
        "title": "Watchdog: anomalous traffic drop",
        "severity": "SEV-4",
        "summary": "Watchdog detected a 35% drop in api.request_count.",
        "customer_impact": "Possible client misconfiguration; no errors observed.",
        "affected_services": ["api"],
        "status": "stable",
        "tasks": [
            ("Cross-check with web RUM session counts", "done"),
            ("Investigate mobile client release notes", "in_progress"),
        ],
    },
]


_AUTHOR_LABELS = [
    "Vedanta Neogi",
    "Priya Sharma",
    "Marcus Chen",
    "Aisha Patel",
    "Diego Ramirez",
]


async def has_any_incidents() -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM incidents LIMIT 1")
    return row is not None


async def seed_if_empty() -> int:
    if await has_any_incidents():
        return 0
    pool = await get_pool()
    inserted = 0
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        for i, t in enumerate(_TEMPLATES):
            inc_id = uuid.uuid4()
            seq = await conn.fetchval(
                "SELECT nextval('incident_display_seq')"
            )
            display_id = f"INC-{seq}"
            created = now - timedelta(hours=random.randint(2, 24 * 6))
            resolved = (
                created + timedelta(minutes=t.get("resolved_offset_minutes", 30))
                if t["status"] in {"resolved", "completed"}
                else None
            )
            completed = (
                created + timedelta(minutes=t.get("resolved_offset_minutes", 30) + 60)
                if t["status"] == "completed"
                else None
            )
            await conn.execute(
                """
                INSERT INTO incidents
                    (id, display_id, title, severity, status, summary,
                     root_cause, customer_impact, detected_via, affected_services,
                     created_at, resolved_at, completed_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                """,
                inc_id, display_id, t["title"], t["severity"], t["status"],
                t.get("summary"), t.get("root_cause"), t.get("customer_impact"),
                "monitor:auto-detected", t["affected_services"],
                created, resolved, completed, resolved or completed or created,
            )

            # Timeline: declaration + a couple of synthetic events + resolution
            tl_time = created
            await conn.execute(
                """
                INSERT INTO incident_timeline
                    (id, incident_id, kind, actor_label, payload, occurred_at)
                VALUES ($1, $2, 'state_change', $3, $4::jsonb, $5)
                """,
                uuid.uuid4(), inc_id, random.choice(_AUTHOR_LABELS),
                json.dumps({"to": "active", "title": t["title"], "severity": t["severity"]}),
                tl_time,
            )
            for j in range(random.randint(3, 8)):
                tl_time += timedelta(minutes=random.randint(2, 15))
                comment = random.choice([
                    "Looking at the dashboards now.",
                    "Confirmed alert; engaging on-call.",
                    "Tagged @platform-oncall in Slack.",
                    "Rolling back recent change as a precaution.",
                    "Customer impact confirmed by support.",
                    "Mitigation deployed; monitoring.",
                    "Pulled traces from APM, root cause is clearer now.",
                ])
                await conn.execute(
                    """
                    INSERT INTO incident_timeline
                        (id, incident_id, kind, actor_label, payload, occurred_at)
                    VALUES ($1, $2, 'comment', $3, $4::jsonb, $5)
                    """,
                    uuid.uuid4(), inc_id, random.choice(_AUTHOR_LABELS),
                    json.dumps({"text": comment}),
                    tl_time,
                )
            if resolved:
                await conn.execute(
                    """
                    INSERT INTO incident_timeline
                        (id, incident_id, kind, actor_label, payload, occurred_at)
                    VALUES ($1, $2, 'state_change', $3, $4::jsonb, $5)
                    """,
                    uuid.uuid4(), inc_id, random.choice(_AUTHOR_LABELS),
                    json.dumps({"from": "active", "to": "resolved"}),
                    resolved,
                )
            if completed:
                await conn.execute(
                    """
                    INSERT INTO incident_timeline
                        (id, incident_id, kind, actor_label, payload, occurred_at)
                    VALUES ($1, $2, 'state_change', $3, $4::jsonb, $5)
                    """,
                    uuid.uuid4(), inc_id, random.choice(_AUTHOR_LABELS),
                    json.dumps({"from": "resolved", "to": "completed"}),
                    completed,
                )

            # Tasks
            for title, status in t.get("tasks", []):
                await conn.execute(
                    """
                    INSERT INTO incident_tasks
                        (id, incident_id, title, status, assignee_label,
                         created_at, completed_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    uuid.uuid4(), inc_id, title, status,
                    random.choice(_AUTHOR_LABELS),
                    created + timedelta(minutes=random.randint(2, 30)),
                    (resolved or completed) if status == "done" else None,
                )

            # Postmortem (only for resolved/completed with template)
            if t.get("postmortem"):
                await conn.execute(
                    """
                    INSERT INTO incident_postmortems
                        (id, incident_id, content, status, template_used)
                    VALUES ($1, $2, $3, $4, 'five-whys')
                    """,
                    uuid.uuid4(), inc_id, t["postmortem"], "draft",
                )
            inserted += 1
    logger.info("incidents.seed: inserted %d incidents", inserted)
    return inserted
