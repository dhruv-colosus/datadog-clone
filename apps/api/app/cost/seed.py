"""Seed 90 days of synthetic cost data + container allocations."""

from __future__ import annotations

import logging
import math
import random
from datetime import datetime, timedelta, timezone

from app.telemetry.pool import get_pool
from app.telemetry.topology import SERVICES


logger = logging.getLogger(__name__)


_REGIONS = ["us-east-1", "us-west-2", "eu-west-1"]
_PROVIDERS = ["aws", "azure", "gcp"]
_ACCOUNTS = {"aws": "112233445566", "azure": "azure-prod-01", "gcp": "gcp-prod-1"}
_RESOURCE_TYPES = ["ec2", "rds", "s3", "data_transfer"]

# Tier-based daily baselines per service ($/day) — sums to ~$1500/day overall
_BASELINES = {
    "web": 110,
    "api": 220,
    "auth": 80,
    "payments": 180,
    "worker": 140,
    "caddy": 35,
    "postgres": 320,
    "redis": 90,
}

_RESOURCE_SHARES = {
    "ec2": 0.55,
    "rds": 0.20,
    "s3": 0.10,
    "data_transfer": 0.15,
}


async def has_any_costs() -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM cost_events LIMIT 1")
    return row is not None


async def seed_if_empty(days: int = 90) -> int:
    if await has_any_costs():
        return 0
    pool = await get_pool()
    inserted = 0
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        for d in range(days, -1, -1):
            day = now - timedelta(days=d)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            # Weekly seasonality: weekends 80% of weekdays
            weekday_mult = 0.8 if day.weekday() >= 5 else 1.0
            # Long-term trend: cost grows ~30% over 90 days
            trend = 1.0 + (days - d) / days * 0.3
            for svc in SERVICES:
                base = _BASELINES.get(svc.name, 50) * weekday_mult * trend
                for region in _REGIONS:
                    region_mult = (
                        1.0 if region == "us-east-1"
                        else 0.5 if region == "us-west-2"
                        else 0.25
                    )
                    for provider in _PROVIDERS:
                        provider_mult = (
                            1.0 if provider == "aws"
                            else 0.4 if provider == "azure"
                            else 0.2
                        )
                        for rtype, share in _RESOURCE_SHARES.items():
                            cost = (
                                base * region_mult * provider_mult * share
                                * (0.85 + random.random() * 0.3)
                            )
                            if cost < 0.5:
                                continue
                            await conn.execute(
                                """
                                INSERT INTO cost_events
                                    (ts, provider, account, service, region,
                                     resource_type, cost_usd, tags)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
                                ON CONFLICT DO NOTHING
                                """,
                                day_start, provider, _ACCOUNTS[provider],
                                svc.name, region, rtype, round(cost, 4),
                                '{"team":"' + (svc.team or "platform") + '"}',
                            )
                            inserted += 1

        # Container allocations (last 30 days)
        for d in range(30, -1, -1):
            day = (now - timedelta(days=d)).date()
            for svc in SERVICES:
                cluster = "prod-cluster-1"
                namespace = svc.team or "platform"
                workload = svc.name
                pods = max(1, int(_BASELINES.get(svc.name, 50) / 30))
                for pi in range(pods):
                    cost = (
                        _BASELINES.get(svc.name, 50)
                        * 0.6
                        * (0.9 + random.random() * 0.2)
                        / pods
                    )
                    await conn.execute(
                        """
                        INSERT INTO cost_allocations
                            (day, cluster, namespace, workload, pod, service, cost_usd)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT DO NOTHING
                        """,
                        day, cluster, namespace, workload,
                        f"{workload}-{pi}", svc.name, round(cost, 4),
                    )
    logger.info("cost.seed: inserted %d cost rows", inserted)
    return inserted
