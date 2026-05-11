"""Background loop that runs due synthetic tests on their frequency.

Wakes every 30s, grabs every enabled test whose `last_run_at` is older
than `frequency_seconds` (or has never run), executes it, and persists
results. Mirrors `app.telemetry.runner.runner_loop`'s shape.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from app.db.session import AsyncSessionLocal
from app.synthetics.executor import (
    execute_browser_with_locations,
    execute_with_locations,
)
from sqlalchemy import text


logger = logging.getLogger(__name__)


_TICK_SECONDS = 30


async def _due_tests() -> list[dict[str, Any]]:
    """Return enabled tests where now - last_run_at >= frequency_seconds."""
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text(
                """
                SELECT id, name, test_type, method, url, request, assertions,
                       browser_config, auth, locations,
                       frequency_seconds, last_run_at
                FROM synthetic_tests
                WHERE enabled = TRUE
                  AND (
                    last_run_at IS NULL
                    OR EXTRACT(EPOCH FROM (NOW() - last_run_at)) >= frequency_seconds
                  )
                """
            )
        )
        out: list[dict[str, Any]] = []
        for row in res:
            out.append(
                {
                    "id": str(row.id),
                    "name": row.name,
                    "testType": row.test_type or "api",
                    "method": row.method,
                    "url": row.url,
                    "request": (
                        row.request
                        if isinstance(row.request, dict)
                        else json.loads(row.request or "{}")
                    ),
                    "assertions": (
                        row.assertions
                        if isinstance(row.assertions, list)
                        else json.loads(row.assertions or "[]")
                    ),
                    "browserConfig": (
                        row.browser_config
                        if isinstance(row.browser_config, dict)
                        else json.loads(row.browser_config or "{}")
                    ),
                    "auth": (
                        row.auth
                        if isinstance(row.auth, dict)
                        else json.loads(row.auth or '{"type":"none"}')
                    ),
                    "locations": list(row.locations or []),
                }
            )
        return out


async def _persist(test_id: str, results: list[dict[str, Any]]) -> None:
    async with AsyncSessionLocal() as db:
        for r in results:
            await db.execute(
                text(
                    """
                    INSERT INTO synthetic_results (
                        id, test_id, location, status, status_code,
                        response_time_ms, timings, assertion_results,
                        response_headers, response_size_bytes, error_message
                    ) VALUES (
                        :id, :test_id, :location, :status, :code, :rt,
                        CAST(:timings AS jsonb),
                        CAST(:assertions AS jsonb),
                        CAST(:headers AS jsonb),
                        :size, :err
                    )
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "test_id": test_id,
                    "location": r["location"],
                    "status": r["status"],
                    "code": r["status_code"],
                    "rt": r["response_time_ms"],
                    "timings": json.dumps(r["timings"]),
                    "assertions": json.dumps(r["assertion_results"]),
                    "headers": json.dumps(r["response_headers"]),
                    "size": r["response_size_bytes"],
                    "err": r["error_message"],
                },
            )

        overall = "ALERT" if any(r["status"] == "ALERT" for r in results) else "OK"
        await db.execute(
            text(
                "UPDATE synthetic_tests SET last_status = :s, last_run_at = NOW() "
                "WHERE id = :id"
            ),
            {"s": overall, "id": test_id},
        )

        # Cap history at 1000 rows per test.
        await db.execute(
            text(
                """
                DELETE FROM synthetic_results
                WHERE test_id = :id
                  AND id NOT IN (
                    SELECT id FROM synthetic_results
                    WHERE test_id = :id
                    ORDER BY executed_at DESC
                    LIMIT 1000
                  )
                """
            ),
            {"id": test_id},
        )
        await db.commit()


async def scheduler_loop() -> None:
    """Run forever; ticks every _TICK_SECONDS."""
    logger.info("synthetics.scheduler: loop start (interval=%ss)", _TICK_SECONDS)
    while True:
        try:
            due = await _due_tests()
            if due:
                logger.info("synthetics.scheduler: %d due tests", len(due))
                # Run all due tests in parallel — each test can have multiple
                # locations which run in parallel inside execute_with_locations.
                async def _run_one(t: dict[str, Any]) -> None:
                    try:
                        if t.get("testType") == "browser":
                            bc = t.get("browserConfig") or {}
                            results = await execute_browser_with_locations(
                                starting_url=bc.get("startingUrl") or t["url"] or "",
                                steps=bc.get("steps") or [],
                                browsers=bc.get("browsers") or ["chrome"],
                                devices=bc.get("devices") or ["laptop_large"],
                                locations=t["locations"] or ["aws:us-east-1"],
                            )
                        else:
                            results = await execute_with_locations(
                                method=t["method"],
                                url=t["url"],
                                request=t["request"],
                                assertions=t["assertions"],
                                auth=t.get("auth") or {"type": "none"},
                                locations=t["locations"] or ["aws:us-east-1"],
                            )
                        await _persist(t["id"], results)
                    except Exception:  # noqa: BLE001
                        logger.exception(
                            "synthetics.scheduler: test %s failed", t["id"]
                        )

                await asyncio.gather(*(_run_one(t) for t in due))
        except Exception:  # noqa: BLE001
            logger.exception("synthetics.scheduler: tick failed; will continue")

        await asyncio.sleep(_TICK_SECONDS)
