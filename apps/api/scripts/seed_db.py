"""Standalone CLI to seed the demo data into Postgres.

Seeds the full topology fixture from `app/telemetry/topology.py` (and the RUM
fixture from `app/rum/topology.py`) into the database. The same code path runs
on API startup via lifespan; this CLI exposes it for manual invocation.

Tables populated (all source-of-truth for the API):
    topology_services, topology_teams, topology_hosts, topology_containers,
    topology_processes, topology_dependencies, metric_catalog, tag_catalog,
    log_templates, operations, rum_applications

Usage from `apps/api/`:

    uv run python -m scripts.seed_db          # idempotent: only seeds if empty
    uv run python -m scripts.seed_db --force  # truncate + reseed (use after
                                              # editing topology.py to change
                                              # host count, services, etc.)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Allow `python -m scripts.seed_db` from apps/api/ without an installed pkg.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.telemetry.pool import close_pool  # noqa: E402
from app.telemetry.seed_topology import (  # noqa: E402
    reseed_topology,
    seed_if_empty,
)


async def _run(force: bool) -> int:
    if force:
        summary = await reseed_topology()
        print(f"reseeded: {summary}")
    else:
        summary = await seed_if_empty()
        if summary is None:
            print("already seeded — no changes (use --force to wipe + reseed)")
        else:
            print(f"seeded: {summary}")
    await close_pool()
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(
        description="Seed demo topology + telemetry catalog into Postgres",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Truncate topology tables and reseed even if non-empty.",
    )
    args = parser.parse_args()
    return asyncio.run(_run(args.force))


if __name__ == "__main__":
    raise SystemExit(main())
