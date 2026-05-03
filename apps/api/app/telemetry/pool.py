"""Raw asyncpg pool for bulk telemetry writes.

The main app uses SQLAlchemy + asyncpg, but `copy_records_to_table` (the fastest
batch path) needs a raw asyncpg connection. Run a small parallel pool dedicated
to telemetry writes so we never starve the API request handlers.
"""

from __future__ import annotations

import asyncpg

from app.core.config import get_settings

_pool: asyncpg.Pool | None = None


def _asyncpg_dsn() -> str:
    """Convert SQLAlchemy-style URL to a plain Postgres DSN for asyncpg."""
    url = get_settings().database_url
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=_asyncpg_dsn(),
            min_size=2,
            max_size=8,
            command_timeout=30,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
