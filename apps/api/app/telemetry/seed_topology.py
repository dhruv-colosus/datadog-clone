"""Idempotent seed of the topology_* and *_catalog tables from `topology.py`.

Wipes-then-inserts on each call so it's safe to invoke from /admin/reseed-topology.
On first boot, the lifespan calls `seed_if_empty` which is a no-op if the
services table already has rows.
"""

from __future__ import annotations

import json
import logging

import asyncpg

from app.rum.topology import APPLICATIONS as RUM_APPLICATIONS
from app.telemetry.pool import get_pool
from app.telemetry.topology import (
    DEPENDENCIES,
    HOSTS,
    LOG_TEMPLATES,
    METRIC_CATALOG,
    OPERATIONS,
    SERVICES,
    TAG_CATALOG,
    TEAM_RECORDS,
    containers_for_host,
    processes_for_host,
    topology_summary,
)


logger = logging.getLogger(__name__)


async def _truncate_topology(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        TRUNCATE
            topology_processes,
            topology_containers,
            topology_dependencies,
            topology_hosts,
            topology_services,
            topology_teams,
            metric_catalog,
            tag_catalog,
            log_templates,
            operations,
            rum_applications
        """
    )


async def _seed(conn: asyncpg.Connection) -> None:
    # Services
    await conn.executemany(
        """
        INSERT INTO topology_services
            (name, type, language, team, tier, repo_url, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        [
            (s.name, s.type, s.language, s.team, s.tier, s.repo_url, s.description)
            for s in SERVICES
        ],
    )
    # Teams
    await conn.executemany(
        """
        INSERT INTO topology_teams (name, slack_channel, oncall_email)
        VALUES ($1, $2, $3)
        """,
        [(t.name, t.slack_channel, t.oncall_email) for t in TEAM_RECORDS],
    )
    # Hosts
    await conn.executemany(
        """
        INSERT INTO topology_hosts (
            id, hostname, role, service, env, region, availability_zone, os,
            cpu_cores, memory_gb, filesystem_gb, ip_address, ipv6_address,
            mac_address, kernel_release, kernel_version, docker_version,
            agent_version, apps, kube_cluster_name, kube_namespace,
            version, team, status
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
            $19,$20,$21,$22,$23,$24
        )
        """,
        [
            (
                h.id, h.hostname, h.role, h.service, h.env, h.region,
                h.availability_zone, h.os, h.cpu_cores, h.memory_gb,
                h.filesystem_gb, h.ip_address, h.ipv6_address, h.mac_address,
                h.kernel_release, h.kernel_version, h.docker_version,
                h.agent_version, list(h.apps), h.kube_cluster_name,
                h.kube_namespace, h.version, h.team, h.status,
            )
            for h in HOSTS
        ],
    )
    # Containers
    container_rows = []
    for h in HOSTS:
        for c in containers_for_host(h):
            container_rows.append(
                (c.host_id, c.name, c.image, c.runtime, c.started_seconds_ago)
            )
    if container_rows:
        await conn.executemany(
            """
            INSERT INTO topology_containers
                (host_id, name, image, runtime, started_seconds_ago)
            VALUES ($1, $2, $3, $4, $5)
            """,
            container_rows,
        )
    # Processes
    process_rows = []
    for h in HOSTS:
        for p in processes_for_host(h):
            process_rows.append(
                (
                    p.host_id, p.pid, p.command, p.parent_pid,
                    p.started_seconds_ago, p.cpu_percent, p.rss_mib,
                )
            )
    if process_rows:
        await conn.executemany(
            """
            INSERT INTO topology_processes
                (host_id, pid, command, parent_pid, started_seconds_ago,
                 cpu_percent, rss_mib)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            process_rows,
        )
    # Dependencies
    await conn.executemany(
        """
        INSERT INTO topology_dependencies (caller, callee, kind, weight)
        VALUES ($1, $2, $3, $4)
        """,
        [(d.caller, d.callee, d.kind, d.weight) for d in DEPENDENCIES],
    )
    # Metric catalog
    await conn.executemany(
        """
        INSERT INTO metric_catalog (
            name, type, unit, description, applicable_services, applicable_roles,
            baseline, daily_amplitude, noise
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        """,
        [
            (
                m.name, m.type, m.unit, m.description,
                list(m.applicable_services), list(m.applicable_roles),
                m.baseline, m.daily_amplitude, m.noise,
            )
            for m in METRIC_CATALOG
        ],
    )
    # Tag catalog
    await conn.executemany(
        """
        INSERT INTO tag_catalog (key, values) VALUES ($1, $2)
        """,
        [(k, list(v)) for k, v in TAG_CATALOG.items()],
    )
    # Log templates
    await conn.executemany(
        """
        INSERT INTO log_templates (service, level, weight, template)
        VALUES ($1, $2, $3, $4)
        """,
        [
            (t.service, t.level, t.weight, t.template) for t in LOG_TEMPLATES
        ],
    )
    # Operations
    await conn.executemany(
        """
        INSERT INTO operations (
            service, name, resource_pool, base_latency_ms, latency_sigma,
            error_rate, is_entry, http_method_pool
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        """,
        [
            (
                o.service, o.name, list(o.resource_pool), o.base_latency_ms,
                o.latency_sigma, o.error_rate, o.is_entry,
                list(o.http_method_pool),
            )
            for o in OPERATIONS
        ],
    )
    # RUM applications
    await conn.executemany(
        """
        INSERT INTO rum_applications (id, name, type, service, env, client_token)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        [
            (a.id, a.name, a.type, a.service, a.env, a.client_token)
            for a in RUM_APPLICATIONS
        ],
    )


async def reseed_topology() -> dict[str, int]:
    """Hard reseed — wipe and re-insert. Used by /admin/reseed-topology."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _truncate_topology(conn)
            await _seed(conn)
    summary = topology_summary()
    logger.info("telemetry.seed_topology: reseeded %s", summary)
    return summary


async def seed_if_empty() -> dict[str, int] | None:
    """Run once on lifespan startup if the services table is empty.

    Also tops up the `rum_applications` table when older deployments seeded
    topology but predate the RUM migration.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        topology_row = await conn.fetchrow("SELECT 1 FROM topology_services LIMIT 1")
        rum_row = await conn.fetchrow("SELECT 1 FROM rum_applications LIMIT 1")
        if topology_row is None:
            async with conn.transaction():
                await _seed(conn)
            summary = topology_summary()
            logger.info("telemetry.seed_topology: initial seed %s", summary)
            return summary
        if rum_row is None:
            await conn.executemany(
                """
                INSERT INTO rum_applications (id, name, type, service, env, client_token)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                [
                    (a.id, a.name, a.type, a.service, a.env, a.client_token)
                    for a in RUM_APPLICATIONS
                ],
            )
            logger.info(
                "telemetry.seed_topology: backfilled %d rum_applications row(s)",
                len(RUM_APPLICATIONS),
            )
        return None
