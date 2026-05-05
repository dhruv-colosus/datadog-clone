"""Default monitor seeds.

Inserts two real, evaluable monitors the first time a user lists their
monitors. The thresholds are tuned against the metric generator's baselines
(see `app/telemetry/topology.py:METRIC_CATALOG`) so they produce a mix of
OK / Alert states once telemetry has been backfilled.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_DEFAULT_MONITORS: list[dict[str, Any]] = [
    {
        "name": "High CPU usage on hosts",
        "type": "metric",
        "query": {
            "metric": "system.cpu.user",
            "aggregator": "avg",
            "windowSeconds": 300,
            "filters": [],
            "groupBy": [],
            "expr": "avg(last_5m):avg:system.cpu.user{*} > 25",
        },
        "thresholds": {
            "critical": 25,
            "warning": 20,
            "operator": ">",
            "evaluation": "AVG over the last 5m",
            "label": "y > 25",
            "missingDataMinutes": 5,
            "missingDataAction": "show_last_known",
        },
        "tags": ["monitor_pack:host", "team:infra"],
        "team": "infra",
        "message": (
            "User-mode CPU on {{host.name}} has reached {{value}}% over the "
            "last 5 minutes — exceeding the threshold of {{threshold}}%."
        ),
        "recovery_message": (
            "CPU on {{host.name}} has recovered. Current value: {{value}}%."
        ),
        "impact": (
            "Sustained CPU saturation slows every workload on the host and "
            "is a leading indicator of cascading latency."
        ),
        "runbook_steps": [
            "Open the Host Map and locate {{host.name}}.",
            "Inspect the top processes by CPU in Live Processes.",
            "Correlate against recent deploys or workload changes.",
        ],
    },
    {
        "name": "Postgres connection pool nearing saturation",
        "type": "metric",
        "query": {
            "metric": "postgresql.percent_usage_connections",
            "aggregator": "avg",
            "windowSeconds": 300,
            "filters": [],
            "groupBy": [],
            "expr": "avg(last_5m):avg:postgresql.percent_usage_connections{*} > 40",
        },
        "thresholds": {
            "critical": 40,
            "warning": 35,
            "operator": ">",
            "evaluation": "AVG over the last 5m",
            "label": "y > 40",
            "missingDataMinutes": 5,
            "missingDataAction": "show_last_known",
        },
        "tags": ["monitor_pack:postgres", "team:platform"],
        "team": "platform",
        "message": (
            "Postgres connection-pool usage has reached {{value}}% — exceeding "
            "the threshold of {{threshold}}%."
        ),
        "recovery_message": (
            "Connection pool usage has recovered. Current value: {{value}}%."
        ),
        "impact": (
            "When the pool saturates, new requests stall waiting for a "
            "connection and downstream services start timing out."
        ),
        "runbook_steps": [
            "Open the Postgres dashboard and inspect active connections by application.",
            "Identify long-running transactions and kill them if safe.",
            "Increase max_connections or pgbouncer pool size if the load is real.",
        ],
    },
    {
        "name": "Anomalous request latency on api",
        "type": "anomaly",
        "query": {
            "metric": "api.request_latency_ms",
            "windowSeconds": 1800,
            "rollupSeconds": 60,
            "deviations": 2.0,
            "direction": "above",
            "algorithm": "basic",
            "seasonality": "hourly",
            "expr": "anomalies(avg:api.request_latency_ms{*}, 'basic', 2)",
        },
        "thresholds": {
            "operator": ">",
            "evaluation": "ANOMALY over the last 30m",
            "label": "value outside 2σ band",
        },
        "tags": ["monitor_pack:api", "team:platform", "algorithm:basic"],
        "team": "platform",
        "priority": 2,
        "message": (
            "api.request_latency_ms is anomalously high — currently {{value}}ms vs. "
            "expected {{mean}}ms (band: {{lower}} to {{upper}})."
        ),
        "recovery_message": "Latency on api has returned to its expected band.",
        "impact": "Tail latency on the API service slows every downstream consumer.",
        "runbook_steps": [
            "Open the api service detail page and inspect resources sorted by p95.",
            "Check Watchdog for related deployment regressions.",
            "Correlate against recent infra changes or DB query plan shifts.",
        ],
    },
    {
        "name": "Anomalous error rate on payments",
        "type": "anomaly",
        "query": {
            "metric": "payments.error_count",
            "windowSeconds": 1800,
            "rollupSeconds": 60,
            "deviations": 2.5,
            "direction": "above",
            "algorithm": "agile",
            "seasonality": "daily",
            "expr": "anomalies(sum:payments.error_count{*}, 'agile', 2.5)",
        },
        "thresholds": {
            "operator": ">",
            "evaluation": "ANOMALY over the last 30m",
            "label": "errors outside 2.5σ band",
        },
        "tags": ["monitor_pack:payments", "team:billing", "algorithm:agile"],
        "team": "billing",
        "priority": 1,
        "message": (
            "payments.error_count spike: {{value}} (band: {{lower}}–{{upper}})."
        ),
        "recovery_message": "payments error rate back within band.",
        "impact": "Payment failures directly impact revenue and customer trust.",
        "runbook_steps": [
            "Check payment processor status pages.",
            "Inspect recent deploys to the payments service.",
            "Review Watchdog stories on the payments service.",
        ],
    },
    {
        "name": "Disk space forecast — postgres host",
        "type": "forecast",
        "query": {
            "metric": "system.disk.used",
            "windowSeconds": 14400,
            "rollupSeconds": 300,
            "forecastWindowSeconds": 86400,
            "algorithm": "linear",
            "expr": "forecast(avg:system.disk.used{host:postgres-1}, 'linear', 1, interval=86400)",
        },
        "thresholds": {
            "operator": ">",
            "critical": 85.0,
            "evaluation": "FORECAST 24h ahead",
            "label": "projected y > 85",
        },
        "tags": ["monitor_pack:host", "team:sre", "algorithm:linear"],
        "team": "sre",
        "priority": 3,
        "message": (
            "Disk usage on postgres-1 is projected to reach {{projectedValue}}% "
            "in the next 24h (current: {{currentValue}}%, threshold: 85%)."
        ),
        "recovery_message": "Disk-usage trend on postgres-1 no longer projected to cross 85%.",
        "impact": "Running out of disk on a Postgres host stalls writes and risks corruption.",
        "runbook_steps": [
            "Identify the largest tables and partitions on postgres-1.",
            "Run vacuum/reindex to reclaim bloat.",
            "Provision additional disk if growth is real.",
        ],
    },
    {
        "name": "Memory forecast — worker pool",
        "type": "forecast",
        "query": {
            "metric": "system.mem.used",
            "windowSeconds": 14400,
            "rollupSeconds": 300,
            "forecastWindowSeconds": 21600,
            "algorithm": "linear",
            "expr": "forecast(avg:system.mem.used{role:worker}, 'linear', 1, interval=21600)",
        },
        "thresholds": {
            "operator": ">",
            "critical": 1.5e10,
            "evaluation": "FORECAST 6h ahead",
            "label": "projected y > 15 GB",
        },
        "tags": ["monitor_pack:host", "team:platform", "algorithm:linear"],
        "team": "platform",
        "priority": 3,
        "message": (
            "Worker memory usage is projected to reach {{projectedValue}} bytes "
            "in 6h (current: {{currentValue}})."
        ),
        "recovery_message": "Worker memory trend back below threshold projection.",
        "impact": "OOM kills on workers cause job loss and retries.",
        "runbook_steps": [
            "Profile the worker for leaks.",
            "Tune the memory limit or scale horizontally.",
        ],
    },
]


async def ensure_default_monitors(db: AsyncSession, owner_id: int) -> int:
    """If `owner_id` has zero monitors, insert the defaults. Returns count inserted.

    Idempotent: subsequent calls do nothing once the user has any monitor
    (so deleted defaults stay deleted).
    """
    res = await db.execute(
        text("SELECT 1 FROM monitors WHERE owner_id = :uid LIMIT 1"),
        {"uid": owner_id},
    )
    if res.first() is not None:
        return 0

    for spec in _DEFAULT_MONITORS:
        await db.execute(
            text(
                """
                INSERT INTO monitors (
                    id, owner_id, name, type, query, thresholds, message,
                    recovery_message, impact, runbook_steps, tags, team
                ) VALUES (
                    :id, :owner, :name, :type,
                    CAST(:query AS jsonb), CAST(:thresholds AS jsonb),
                    :message, :recovery, :impact,
                    CAST(:runbook AS jsonb), :tags, :team
                )
                """
            ),
            {
                "id": uuid.uuid4(),
                "owner": owner_id,
                "name": spec["name"],
                "type": spec["type"],
                "query": json.dumps(spec["query"]),
                "thresholds": json.dumps(spec["thresholds"]),
                "message": spec["message"],
                "recovery": spec["recovery_message"],
                "impact": spec["impact"],
                "runbook": json.dumps(spec["runbook_steps"]),
                "tags": list(spec["tags"]),
                "team": spec["team"],
            },
        )
    await db.commit()
    return len(_DEFAULT_MONITORS)
