"""Smoke tests — exercise routes that do not require a live Postgres."""
from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client: httpx.AsyncClient) -> None:
    """`/health` is the docker-compose liveness probe — must always return 200
    without touching the database."""
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_auth_config_endpoint(client: httpx.AsyncClient) -> None:
    """`/auth/config` exposes whether test-login is enabled. Pure config —
    no DB call. Tests defaults to False, mirroring production env."""
    res = await client.get("/auth/config")
    assert res.status_code == 200
    body = res.json()
    assert "test_auth_enabled" in body
    assert body["test_auth_enabled"] is False


@pytest.mark.asyncio
async def test_openapi_schema_lists_expected_tags(
    client: httpx.AsyncClient,
) -> None:
    """The OpenAPI schema is the source of truth for the API surface. This
    test guards against accidentally dropping a feature surface from the
    router include in `app/api/router.py`."""
    res = await client.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()

    declared_tags = {
        op.get("tags", [None])[0]
        for path_methods in schema["paths"].values()
        for op in path_methods.values()
        if isinstance(op, dict)
    }

    expected = {"auth", "health"}
    missing = expected - declared_tags
    assert not missing, f"missing tags in OpenAPI: {missing}"


@pytest.mark.asyncio
async def test_test_login_returns_404_when_disabled(
    client: httpx.AsyncClient,
) -> None:
    """`/auth/test-login` is the playwright bootstrap helper. It MUST return
    404 when TEST_AUTH_ENABLED is false — that is the gate that prevents it
    from being a backdoor in production."""
    res = await client.post("/auth/test-login")
    assert res.status_code == 404
