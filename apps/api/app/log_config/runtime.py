"""In-process cache of pipelines + scrubbers, refreshed periodically.

The log generator calls `apply_to_log()` on every new line before INSERT.
Cached configs are refreshed every 30s so the Live editor reflects in the
data stream within a tick or two.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from app.log_config.processors import apply_processors
from app.log_config.scrubber import scrub_log
from app.telemetry.pool import get_pool


logger = logging.getLogger(__name__)

REFRESH_INTERVAL_SECONDS = 30

_lock = asyncio.Lock()
_pipelines: list[dict[str, Any]] = []
_scrubbers: list[dict[str, Any]] = []


def _matches_filter(log: dict[str, Any], filter_query: str) -> bool:
    """Tiny filter language: 'service:foo status:bar text'.

    Empty filter matches everything.
    """
    if not filter_query.strip():
        return True
    parts = filter_query.split()
    for p in parts:
        if ":" in p:
            k, v = p.split(":", 1)
            actual = str(log.get(k, "")).lower()
            if actual != v.lower():
                return False
        else:
            if p.lower() not in str(log.get("message", "")).lower():
                return False
    return True


async def refresh_caches() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        pipelines = await conn.fetch(
            "SELECT id, name, filter_query, processors, enabled, order_index "
            "FROM log_pipelines WHERE enabled = TRUE "
            "ORDER BY order_index ASC, created_at ASC"
        )
        scrubbers = await conn.fetch(
            "SELECT id, name, pattern_kind, library_pattern_id, custom_regex, "
            "replacement_strategy, scope_namespaces, enabled "
            "FROM scrubber_rules WHERE enabled = TRUE"
        )
    async with _lock:
        global _pipelines, _scrubbers
        _pipelines = [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "filter_query": r["filter_query"],
                "processors": r["processors"] if isinstance(r["processors"], list) else [],
                "enabled": r["enabled"],
                "order_index": r["order_index"],
            }
            for r in pipelines
        ]
        _scrubbers = [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "pattern_kind": r["pattern_kind"],
                "library_pattern_id": r["library_pattern_id"],
                "custom_regex": r["custom_regex"],
                "replacement_strategy": r["replacement_strategy"],
                "scope_namespaces": list(r["scope_namespaces"] or []),
                "enabled": r["enabled"],
            }
            for r in scrubbers
        ]


async def refresh_loop() -> None:
    while True:
        try:
            await refresh_caches()
        except Exception:  # noqa: BLE001
            logger.exception("log_config.refresh: failed; will retry")
        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)


def apply_to_log(log: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run pipelines that match the filter, then scrubbers; return (log, findings)."""
    out = dict(log)
    for p in _pipelines:
        if _matches_filter(out, p.get("filter_query", "")):
            try:
                out = apply_processors(out, p.get("processors", []))
            except Exception:  # noqa: BLE001
                pass
    # Filter scrubbers by scope_namespaces (matches service)
    applicable = [
        s
        for s in _scrubbers
        if not s.get("scope_namespaces")
        or out.get("service") in s["scope_namespaces"]
    ]
    out, findings = scrub_log(out, applicable)
    return out, findings


async def persist_findings(
    findings: list[dict[str, Any]],
    *,
    service: str,
    log_id: str | None = None,
) -> None:
    if not findings:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        for f in findings:
            await conn.execute(
                """
                INSERT INTO scrubber_findings
                    (id, rule_id, service, log_id, excerpt_redacted, pattern_matched)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
                """,
                f["rule_id"], service, log_id,
                f["excerpt_redacted"], f["pattern_matched"],
            )
