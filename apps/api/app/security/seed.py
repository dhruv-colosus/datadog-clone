"""Seed detection rules + sample signals so /security/signals isn't empty."""

from __future__ import annotations

import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.telemetry.pool import get_pool


logger = logging.getLogger(__name__)


_RULES: list[dict[str, Any]] = [
    {
        "name": "Failed login burst",
        "description": "Detects bursts of failed authentication attempts that may indicate credential stuffing.",
        "rule_type": "threshold",
        "source": "logs",
        "query": "auth failed login",
        "cases": [
            {"name": "critical", "condition": "count > 50 in 1m", "severity": "critical"},
            {"name": "high", "condition": "count > 20 in 1m", "severity": "high"},
        ],
        "severity_default": "high",
        "tags": ["security", "auth", "credential-stuffing"],
        "mitre_tactics": ["TA0006:Credential Access"],
    },
    {
        "name": "Suspicious privilege escalation",
        "description": "Audit log indicates a user assumed an elevated role outside business hours.",
        "rule_type": "log_signature",
        "source": "audit",
        "query": "role:admin assumed_by",
        "cases": [
            {"name": "default", "condition": "count > 0", "severity": "high"},
        ],
        "severity_default": "high",
        "tags": ["security", "iam", "privesc"],
        "mitre_tactics": ["TA0004:Privilege Escalation"],
    },
    {
        "name": "Anomalous data egress on payments",
        "description": "Payments service emitted unusually large response payloads.",
        "rule_type": "anomaly",
        "source": "spans",
        "query": "service:payments",
        "cases": [
            {"name": "default", "condition": "p99(response_size) > 5x baseline", "severity": "high"},
        ],
        "severity_default": "high",
        "tags": ["security", "payments", "exfiltration"],
        "mitre_tactics": ["TA0010:Exfiltration"],
    },
    {
        "name": "Web 5xx storm",
        "description": "Sustained 5xx errors on web service may indicate exploitation attempts.",
        "rule_type": "threshold",
        "source": "logs",
        "query": "status:5xx service:web",
        "cases": [
            {"name": "high", "condition": "count > 100 in 5m", "severity": "high"},
            {"name": "medium", "condition": "count > 30 in 5m", "severity": "medium"},
        ],
        "severity_default": "medium",
        "tags": ["security", "web", "errors"],
        "mitre_tactics": ["TA0001:Initial Access"],
    },
    {
        "name": "New SSH source IP for prod hosts",
        "description": "First-time SSH source IP observed connecting to a production host.",
        "rule_type": "new_term",
        "source": "audit",
        "query": "event:ssh.connect",
        "cases": [
            {"name": "default", "condition": "new src_ip", "severity": "medium"},
        ],
        "severity_default": "medium",
        "tags": ["security", "infra", "ssh"],
        "mitre_tactics": ["TA0001:Initial Access"],
    },
    {
        "name": "Unusual API key usage",
        "description": "API key used from a region it has never been used from before.",
        "rule_type": "new_term",
        "source": "logs",
        "query": "event:api_key.used",
        "cases": [
            {"name": "default", "condition": "new region", "severity": "medium"},
        ],
        "severity_default": "medium",
        "tags": ["security", "api"],
        "mitre_tactics": ["TA0001:Initial Access"],
    },
    {
        "name": "Worker queue command injection signature",
        "description": "Job payload contains substrings matching known command-injection patterns.",
        "rule_type": "log_signature",
        "source": "logs",
        "query": "service:worker payload:$(",
        "cases": [
            {"name": "default", "condition": "match", "severity": "critical"},
        ],
        "severity_default": "critical",
        "tags": ["security", "worker", "injection"],
        "mitre_tactics": ["TA0002:Execution"],
    },
    {
        "name": "Container drift detected",
        "description": "Read-only container had unexpected file modifications.",
        "rule_type": "log_signature",
        "source": "audit",
        "query": "event:container.drift",
        "cases": [
            {"name": "default", "condition": "match", "severity": "high"},
        ],
        "severity_default": "high",
        "tags": ["security", "infra", "containers"],
        "mitre_tactics": ["TA0003:Persistence"],
    },
    {
        "name": "Authentication token replay",
        "description": "Same auth token observed from two different IPs within 60 seconds.",
        "rule_type": "anomaly",
        "source": "logs",
        "query": "event:auth.token_used",
        "cases": [
            {"name": "default", "condition": "duplicate_token in 60s", "severity": "high"},
        ],
        "severity_default": "high",
        "tags": ["security", "auth"],
        "mitre_tactics": ["TA0006:Credential Access"],
    },
    {
        "name": "Postgres slow login storm",
        "description": "Spike in failed Postgres logins from same source IP.",
        "rule_type": "threshold",
        "source": "logs",
        "query": "service:postgres pg_authentication_failed",
        "cases": [
            {"name": "default", "condition": "count > 10 in 1m", "severity": "medium"},
        ],
        "severity_default": "medium",
        "tags": ["security", "postgres"],
        "mitre_tactics": ["TA0006:Credential Access"],
    },
]


_SIGNAL_TEMPLATES: list[dict[str, Any]] = [
    {
        "rule_idx": 0,
        "title": "Burst of 67 failed logins from 198.51.100.42",
        "severity": "critical",
        "service": "auth",
        "user": "alice@example.com",
        "host": "auth-1",
        "evidence": {
            "count": 67,
            "windowSeconds": 60,
            "sourceIp": "198.51.100.42",
            "userAgents": ["curl/7.81", "python-requests/2.28"],
        },
    },
    {
        "rule_idx": 0,
        "title": "Burst of 28 failed logins targeting admin account",
        "severity": "high",
        "service": "auth",
        "user": "admin@example.com",
        "evidence": {"count": 28, "windowSeconds": 60, "sourceIp": "203.0.113.7"},
    },
    {
        "rule_idx": 1,
        "title": "User u_4521 assumed admin role at 02:14",
        "severity": "high",
        "service": "auth",
        "user": "u_4521",
        "evidence": {"role": "admin", "outsideBusinessHours": True},
    },
    {
        "rule_idx": 2,
        "title": "Anomalous payments response payload (p99: 12.4MB)",
        "severity": "high",
        "service": "payments",
        "evidence": {"p99Bytes": 13002400, "baselineBytes": 240000, "ratio": 54.2},
    },
    {
        "rule_idx": 3,
        "title": "Web service 5xx storm: 124 errors in 5m",
        "severity": "high",
        "service": "web",
        "evidence": {"errorCount": 124, "windowSeconds": 300},
    },
    {
        "rule_idx": 3,
        "title": "Web 5xx elevated: 41 errors in 5m",
        "severity": "medium",
        "service": "web",
        "evidence": {"errorCount": 41, "windowSeconds": 300},
    },
    {
        "rule_idx": 4,
        "title": "New SSH source IP for prod-host-2",
        "severity": "medium",
        "service": "infra",
        "host": "prod-host-2",
        "evidence": {"sourceIp": "192.0.2.211", "previouslySeen": False},
    },
    {
        "rule_idx": 5,
        "title": "API key sk_live_***A12 used from new region (eu-west-3)",
        "severity": "medium",
        "service": "api",
        "evidence": {"keyPrefix": "sk_live_***A12", "newRegion": "eu-west-3"},
    },
    {
        "rule_idx": 6,
        "title": "Worker job contains $(rm -rf signature",
        "severity": "critical",
        "service": "worker",
        "evidence": {"payloadSnippet": "$(rm -rf /var/log/...)"},
    },
    {
        "rule_idx": 7,
        "title": "Container drift on payments-1: /etc/passwd modified",
        "severity": "high",
        "service": "payments",
        "host": "payments-1",
        "evidence": {"modifiedPath": "/etc/passwd"},
    },
    {
        "rule_idx": 8,
        "title": "Auth token replay across 2 IPs in 23s",
        "severity": "high",
        "service": "auth",
        "user": "u_8830",
        "evidence": {"ips": ["198.51.100.10", "203.0.113.21"], "deltaSeconds": 23},
    },
    {
        "rule_idx": 9,
        "title": "Postgres login storm: 19 failures in 1m",
        "severity": "medium",
        "service": "postgres",
        "evidence": {"count": 19, "sourceIp": "198.51.100.42"},
    },
    {
        "rule_idx": 1,
        "title": "User u_2102 assumed admin role",
        "severity": "high",
        "service": "auth",
        "user": "u_2102",
        "evidence": {"role": "admin"},
    },
    {
        "rule_idx": 0,
        "title": "Failed login burst from 203.0.113.50",
        "severity": "high",
        "service": "auth",
        "evidence": {"count": 31, "sourceIp": "203.0.113.50"},
    },
    {
        "rule_idx": 4,
        "title": "New SSH source IP for prod-host-1",
        "severity": "medium",
        "service": "infra",
        "host": "prod-host-1",
        "evidence": {"sourceIp": "198.51.100.99"},
    },
]


async def has_any_rules() -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM detection_rules LIMIT 1")
    return row is not None


async def seed_if_empty() -> tuple[int, int]:
    if await has_any_rules():
        return 0, 0
    pool = await get_pool()
    rule_ids: list[uuid.UUID] = []
    async with pool.acquire() as conn:
        for r in _RULES:
            new_id = uuid.uuid4()
            rule_ids.append(new_id)
            await conn.execute(
                """
                INSERT INTO detection_rules
                    (id, name, description, rule_type, source, query, cases,
                     severity_default, enabled, tags, mitre_tactics)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, TRUE, $9, $10)
                """,
                new_id, r["name"], r["description"], r["rule_type"], r["source"],
                r["query"], json.dumps(r["cases"]),
                r["severity_default"], r["tags"], r["mitre_tactics"],
            )
        now = datetime.now(timezone.utc)
        for s in _SIGNAL_TEMPLATES:
            rule_id = rule_ids[s["rule_idx"]]
            created = now - timedelta(minutes=random.randint(5, 60 * 24 * 5))
            status = random.choices(
                ["open", "under_review", "archived"],
                weights=[0.55, 0.25, 0.2],
            )[0]
            archive_reason = (
                random.choice(["tp_malicious", "tp_benign", "fp_other"])
                if status == "archived"
                else None
            )
            triaged_at = (
                created + timedelta(minutes=random.randint(5, 120))
                if status != "open"
                else None
            )
            await conn.execute(
                """
                INSERT INTO security_signals
                    (id, rule_id, title, severity, status, archive_reason,
                     affected_service, affected_host, affected_user,
                     evidence, mitre_tactics, created_at, triaged_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
                """,
                uuid.uuid4(), rule_id, s["title"], s["severity"],
                status, archive_reason,
                s.get("service"), s.get("host"), s.get("user"),
                json.dumps(s.get("evidence", {})),
                _RULES[s["rule_idx"]]["mitre_tactics"],
                created, triaged_at,
            )
    logger.info(
        "security.seed: inserted %d rules and %d signals",
        len(_RULES), len(_SIGNAL_TEMPLATES),
    )
    return len(_RULES), len(_SIGNAL_TEMPLATES)
