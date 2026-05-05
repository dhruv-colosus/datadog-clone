"""Seed default pipelines, facets, and scrubber rules."""

from __future__ import annotations

import json
import logging
import uuid

from app.telemetry.pool import get_pool


logger = logging.getLogger(__name__)


_PIPELINES = [
    {
        "name": "API JSON parser",
        "filter_query": "service:api",
        "processors": [
            {
                "type": "grok-parser",
                "enabled": True,
                "config": {
                    "source": "message",
                    "patterns": [
                        "%{NUMBER:duration} %{WORD:level} %{GREEDYDATA:msg}",
                    ],
                },
            },
            {
                "type": "status-remapper",
                "enabled": True,
                "config": {"source": "level"},
            },
            {
                "type": "attribute-remapper",
                "enabled": True,
                "config": {"source": "duration", "target": "request.duration_ms", "cast": "double"},
            },
        ],
    },
    {
        "name": "Web access log parser",
        "filter_query": "service:web",
        "processors": [
            {
                "type": "grok-parser",
                "enabled": True,
                "config": {
                    "source": "message",
                    "patterns": [
                        '%{IP:client_ip} - - \\[%{DATA:timestamp}\\] "%{WORD:method} %{NOTSPACE:path}" %{INT:status} %{INT:bytes}',
                    ],
                },
            },
            {
                "type": "url-parser",
                "enabled": True,
                "config": {"source": "path"},
            },
        ],
    },
    {
        "name": "Auth security normalizer",
        "filter_query": "service:auth",
        "processors": [
            {
                "type": "category-processor",
                "enabled": True,
                "config": {
                    "target": "event.category",
                    "cases": [
                        {"name": "login_success", "attribute": "message", "operator": "matches", "value": "successful login"},
                        {"name": "login_failure", "attribute": "message", "operator": "matches", "value": "failed login"},
                    ],
                },
            },
        ],
    },
    {
        "name": "Payments compliance",
        "filter_query": "service:payments",
        "processors": [
            {
                "type": "attribute-remapper",
                "enabled": True,
                "config": {"source": "amount", "target": "transaction.amount_usd", "cast": "double"},
            },
        ],
    },
    {
        "name": "Worker job tracker",
        "filter_query": "service:worker",
        "processors": [
            {
                "type": "trace-id-remapper",
                "enabled": True,
                "config": {"source": "trace_id"},
            },
        ],
    },
    {
        "name": "Postgres slowlog",
        "filter_query": "service:postgres",
        "processors": [
            {
                "type": "grok-parser",
                "enabled": True,
                "config": {
                    "source": "message",
                    "patterns": ["duration: %{NUMBER:db.duration_ms} ms"],
                },
            },
        ],
    },
]


_FACETS = [
    ("@http.status_code", "Status code", "qualitative", "integer", "HTTP"),
    ("@http.method", "Method", "qualitative", "string", "HTTP"),
    ("@http.path", "Path", "qualitative", "string", "HTTP"),
    ("@duration", "Duration", "quantitative", "double", "Performance"),
    ("@request.duration_ms", "Request duration (ms)", "quantitative", "double", "Performance"),
    ("@db.duration_ms", "DB query duration (ms)", "quantitative", "double", "Performance"),
    ("@user.id", "User ID", "qualitative", "string", "User"),
    ("@user.email", "User email", "qualitative", "string", "User"),
    ("@event.category", "Event category", "qualitative", "string", "Auth"),
    ("@trace_id", "Trace ID", "qualitative", "string", "APM"),
    ("@transaction.amount_usd", "Transaction amount (USD)", "quantitative", "double", "Payments"),
    ("@error.type", "Error type", "qualitative", "string", "Errors"),
    ("@error.stack", "Error stack", "qualitative", "string", "Errors"),
]


_SCRUBBERS = [
    ("Redact US Social Security Numbers", "us_ssn", "redact", True),
    ("Mask Visa credit cards", "credit_card_visa", "partial_redact", True),
    ("Mask Mastercard credit cards", "credit_card_mastercard", "partial_redact", True),
    ("Hash email addresses", "email", "hash", True),
    ("Redact AWS Access Keys", "aws_access_key", "redact", True),
    ("Redact JWT tokens", "jwt", "redact", True),
    ("Redact Stripe secret keys", "stripe_secret", "redact", True),
    ("Hash IP addresses", "ipv4", "hash", False),
    ("Redact UUIDs", "uuid", "redact", False),
    ("Mask US phone numbers", "phone_us", "partial_redact", False),
]


async def has_any_pipelines() -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM log_pipelines LIMIT 1")
    return row is not None


async def seed_if_empty() -> tuple[int, int, int]:
    if await has_any_pipelines():
        return 0, 0, 0
    pool = await get_pool()
    async with pool.acquire() as conn:
        for i, p in enumerate(_PIPELINES):
            await conn.execute(
                """
                INSERT INTO log_pipelines
                    (id, name, filter_query, processors, enabled, order_index)
                VALUES ($1, $2, $3, $4::jsonb, TRUE, $5)
                """,
                uuid.uuid4(), p["name"], p["filter_query"],
                json.dumps(p["processors"]), i,
            )
        for path, name, kind, dtype, group in _FACETS:
            await conn.execute(
                """
                INSERT INTO log_facets
                    (id, path, display_name, facet_kind, data_type, group_name)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (path) DO NOTHING
                """,
                uuid.uuid4(), path, name, kind, dtype, group,
            )
        for name, library_id, strategy, enabled in _SCRUBBERS:
            await conn.execute(
                """
                INSERT INTO scrubber_rules
                    (id, name, pattern_kind, library_pattern_id,
                     replacement_strategy, enabled)
                VALUES ($1, $2, 'library', $3, $4, $5)
                """,
                uuid.uuid4(), name, library_id, strategy, enabled,
            )
    logger.info(
        "log_config.seed: pipelines=%d facets=%d scrubbers=%d",
        len(_PIPELINES), len(_FACETS), len(_SCRUBBERS),
    )
    return len(_PIPELINES), len(_FACETS), len(_SCRUBBERS)
