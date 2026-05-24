"""Shared pytest fixtures.

We bypass the FastAPI `lifespan` in unit tests because it boots background
runners (telemetry, monitors, synthetics, watchdog, log_config) and touches
Postgres — neither is appropriate for a unit-level smoke run.

For tests that need the DB, mount a real Postgres via docker
(`task datadog:up`) and skip these unit fixtures.
"""
from __future__ import annotations

import os
from typing import AsyncIterator

import httpx
import pytest

# Disable JWT signing surprises and any prod-only feature flags in tests.
os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/test")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("COOKIE_DOMAIN", "localhost")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("COOKIE_SAMESITE", "lax")
os.environ.setdefault("TEST_AUTH_ENABLED", "false")
os.environ.setdefault("GENERATOR_ENABLED", "false")
os.environ.setdefault("BACKFILL_ON_BOOT", "false")


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    """ASGI client that skips lifespan startup."""
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as ac:
        yield ac
