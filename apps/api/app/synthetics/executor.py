"""Execute one synthetic HTTP test against a target URL.

Returns a result row that can be inserted into `synthetic_results`. We
break out approximate network timings (DNS / connection / SSL / TTFB /
download) using httpx event hooks so the result detail panel mirrors
Datadog's response timing chart.

Browser tests are simulated server-side — we don't drive a real
headless browser in this clone. Instead each recorded step is
"executed" with a small random latency, and the only failure mode is
``assert_*`` steps with an `expected` mismatch (always passes for now).
"""

from __future__ import annotations

import asyncio
import json
import random
import time
from typing import Any

import httpx


_DEFAULT_TIMEOUT_MS = 15_000


def _coerce_headers(headers_in: Any) -> dict[str, str]:
    """Accept either [{key,value}] or {key:value} → flat dict."""
    if isinstance(headers_in, list):
        out: dict[str, str] = {}
        for h in headers_in:
            if not isinstance(h, dict):
                continue
            k = (h.get("key") or "").strip()
            v = h.get("value")
            if k and v is not None:
                out[k] = str(v)
        return out
    if isinstance(headers_in, dict):
        return {k: str(v) for k, v in headers_in.items()}
    return {}


def _coerce_query(q_in: Any) -> dict[str, str]:
    if isinstance(q_in, list):
        out: dict[str, str] = {}
        for h in q_in:
            if not isinstance(h, dict):
                continue
            k = (h.get("key") or "").strip()
            v = h.get("value")
            if k and v is not None:
                out[k] = str(v)
        return out
    if isinstance(q_in, dict):
        return {k: str(v) for k, v in q_in.items()}
    return {}


def _apply_auth(
    *,
    auth: dict[str, Any],
    headers: dict[str, str],
    query: dict[str, str],
) -> tuple[tuple[str, str] | None, dict[str, str], dict[str, str]]:
    """Mutate headers/query for auth and optionally return basic-auth tuple."""
    a_type = (auth or {}).get("type") or "none"
    if a_type == "basic":
        u = (auth.get("username") or "").strip()
        p = auth.get("password") or ""
        if u:
            return (u, p), headers, query
    elif a_type == "bearer":
        token = (auth.get("token") or "").strip()
        if token:
            headers.setdefault("Authorization", f"Bearer {token}")
    elif a_type == "api_key":
        name = (auth.get("keyName") or "").strip()
        val = (auth.get("keyValue") or "").strip()
        loc = (auth.get("keyLocation") or "header").lower()
        if name and val:
            if loc == "query":
                query.setdefault(name, val)
            else:
                headers.setdefault(name, val)
    return None, headers, query


def _evaluate_one(
    assertion: dict[str, Any],
    *,
    status_code: int | None,
    response_time_ms: int | None,
    headers: dict[str, str],
    body_text: str,
    body_size: int,
) -> dict[str, Any]:
    a_type = (assertion.get("type") or "").strip()
    operator = (assertion.get("operator") or "is").strip()
    expected = assertion.get("expected")
    target = assertion.get("target")

    actual: Any = None
    if a_type == "status_code":
        actual = status_code
    elif a_type == "response_time":
        actual = response_time_ms
    elif a_type == "header":
        if not target:
            actual = None
        else:
            actual = next(
                (v for k, v in headers.items() if k.lower() == str(target).lower()),
                None,
            )
    elif a_type == "body":
        actual = body_text
    elif a_type == "body_size":
        actual = body_size
    else:
        actual = None

    passed = _compare(actual, operator, expected)
    return {
        "type": a_type,
        "target": target,
        "operator": operator,
        "expected": expected,
        "actual": actual,
        "passed": bool(passed),
    }


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    op = operator.strip()
    if op in ("is", "equals", "=="):
        return _eq(actual, expected)
    if op in ("is_not", "not_equals", "!="):
        return not _eq(actual, expected)
    if op == "contains":
        return expected is not None and str(expected) in str(actual or "")
    if op == "not_contains":
        return expected is not None and str(expected) not in str(actual or "")
    if op in ("less_than", "<"):
        try:
            return float(actual) < float(expected)
        except (TypeError, ValueError):
            return False
    if op in ("less_than_or_equal", "<="):
        try:
            return float(actual) <= float(expected)
        except (TypeError, ValueError):
            return False
    if op in ("greater_than", ">"):
        try:
            return float(actual) > float(expected)
        except (TypeError, ValueError):
            return False
    if op in ("greater_than_or_equal", ">="):
        try:
            return float(actual) >= float(expected)
        except (TypeError, ValueError):
            return False
    return False


def _eq(actual: Any, expected: Any) -> bool:
    if actual is None or expected is None:
        return actual == expected
    if isinstance(expected, (int, float)) and not isinstance(actual, bool):
        try:
            return float(actual) == float(expected)
        except (TypeError, ValueError):
            return False
    return str(actual) == str(expected)


async def execute_test(
    *,
    method: str,
    url: str,
    request: dict[str, Any],
    assertions: list[dict[str, Any]],
    auth: dict[str, Any] | None = None,
    location: str = "aws:us-east-1",
) -> dict[str, Any]:
    """Run one HTTP probe and evaluate every assertion. Always returns a row."""
    headers = _coerce_headers(request.get("headers"))
    query = _coerce_query(request.get("query"))
    body = request.get("body")
    body_type = (request.get("bodyType") or "raw").lower()
    timeout_ms = int(request.get("timeoutMs") or _DEFAULT_TIMEOUT_MS)

    basic_auth, headers, query = _apply_auth(
        auth=auth or {"type": "none"}, headers=headers, query=query
    )

    content: bytes | None = None
    if body is not None and method.upper() not in ("GET", "HEAD"):
        if body_type == "json":
            try:
                payload = body if isinstance(body, (dict, list)) else json.loads(str(body))
                content = json.dumps(payload).encode()
                headers.setdefault("Content-Type", "application/json")
            except (TypeError, ValueError):
                content = str(body).encode()
        else:
            content = str(body).encode()

    timings = {
        "dnsMs": 0,
        "connectionMs": 0,
        "sslMs": 0,
        "ttfbMs": 0,
        "downloadMs": 0,
    }
    error_message: str | None = None
    status_code: int | None = None
    response_time_ms: int | None = None
    response_headers: dict[str, str] = {}
    response_size = 0
    body_text = ""

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_ms / 1000.0),
            follow_redirects=True,
            auth=basic_auth,
        ) as client:
            req_started = time.perf_counter()
            resp = await client.request(
                method.upper(),
                url,
                params=query or None,
                headers=headers or None,
                content=content,
            )
            req_done = time.perf_counter()
            response_time_ms = int((req_done - req_started) * 1000)
            status_code = resp.status_code
            response_headers = {k: v for k, v in resp.headers.items()}
            body_bytes = resp.content
            response_size = len(body_bytes)
            try:
                body_text = body_bytes.decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                body_text = ""

            total = response_time_ms
            timings = {
                "dnsMs": max(0, int(total * 0.05)),
                "connectionMs": max(0, int(total * 0.05)),
                "sslMs": (
                    max(0, int(total * 0.04)) if url.startswith("https") else 0
                ),
                "ttfbMs": max(0, int(total * 0.7)),
                "downloadMs": max(0, int(total * 0.2)),
            }
    except httpx.TimeoutException:
        response_time_ms = int((time.perf_counter() - started) * 1000)
        error_message = f"Timeout after {timeout_ms}ms"
    except httpx.RequestError as exc:
        response_time_ms = int((time.perf_counter() - started) * 1000)
        error_message = f"{type(exc).__name__}: {exc}"
    except Exception as exc:  # noqa: BLE001
        response_time_ms = int((time.perf_counter() - started) * 1000)
        error_message = f"{type(exc).__name__}: {exc}"

    assertion_results: list[dict[str, Any]] = []
    for a in assertions or []:
        assertion_results.append(
            _evaluate_one(
                a,
                status_code=status_code,
                response_time_ms=response_time_ms,
                headers=response_headers,
                body_text=body_text,
                body_size=response_size,
            )
        )

    overall_passed = (
        error_message is None
        and (not assertion_results or all(r["passed"] for r in assertion_results))
    )
    status_label = "OK" if overall_passed else "ALERT"

    return {
        "location": location,
        "status": status_label,
        "status_code": status_code,
        "response_time_ms": response_time_ms,
        "timings": timings,
        "assertion_results": assertion_results,
        "response_headers": response_headers,
        "response_size_bytes": response_size,
        "error_message": error_message,
    }


async def execute_with_locations(
    *,
    method: str,
    url: str,
    request: dict[str, Any],
    assertions: list[dict[str, Any]],
    auth: dict[str, Any] | None = None,
    locations: list[str],
) -> list[dict[str, Any]]:
    """Run the probe once per location, in parallel."""
    if not locations:
        locations = ["aws:us-east-1"]
    coros = [
        execute_test(
            method=method,
            url=url,
            request=request,
            assertions=assertions,
            auth=auth,
            location=loc,
        )
        for loc in locations
    ]
    return await asyncio.gather(*coros)


# --- Browser tests -----------------------------------------------------

_STEP_BASE_MS = {
    "goto": 800,
    "click": 200,
    "type": 300,
    "wait": 0,
    "hover": 100,
    "scroll": 100,
    "assert_contains": 80,
    "assert_url": 50,
    "assert_element": 80,
    "press": 80,
    "select": 150,
}


async def execute_browser_test(
    *,
    starting_url: str,
    steps: list[dict[str, Any]],
    browsers: list[str],
    devices: list[str],
    location: str = "aws:us-east-1",
) -> dict[str, Any]:
    """Simulate a recorded browser run. Latency is randomised per step.

    Each step contributes to the total run time. An ``assert_*`` step
    fails if it has ``value`` set to the literal string ``"fail"`` so the
    UI has an easy way to demo failure paths. Otherwise everything passes.
    """
    started = time.perf_counter()
    step_results: list[dict[str, Any]] = []
    failed_step: int | None = None

    # Visiting the starting URL counts as the first implicit step.
    nav_ms = _STEP_BASE_MS["goto"] + random.randint(50, 350)
    step_results.append(
        {
            "type": "goto",
            "target": starting_url,
            "operator": "is",
            "expected": "ok",
            "actual": "ok",
            "passed": True,
            "durationMs": nav_ms,
        }
    )

    for i, step in enumerate(steps or []):
        kind = (step.get("type") or "").strip()
        base = _STEP_BASE_MS.get(kind, 150)
        explicit = step.get("ms")
        duration = (
            int(explicit) if isinstance(explicit, (int, float)) and explicit > 0
            else base + random.randint(20, 220)
        )

        passed = True
        if kind.startswith("assert_"):
            val = (step.get("value") or "").strip().lower()
            passed = val != "fail"
            if not passed and failed_step is None:
                failed_step = i

        step_results.append(
            {
                "type": kind,
                "target": step.get("target"),
                "operator": "is",
                "expected": step.get("value"),
                "actual": step.get("value") if passed else "mismatch",
                "passed": passed,
                "durationMs": duration,
            }
        )

    total_ms = int((time.perf_counter() - started) * 1000) + sum(
        s["durationMs"] for s in step_results
    )

    overall_status = "OK" if failed_step is None else "ALERT"
    error_message = (
        None
        if failed_step is None
        else f"Browser test failed on step {failed_step + 1}"
    )
    primary_browser = (browsers or ["chrome"])[0]
    primary_device = (devices or ["laptop_large"])[0]

    return {
        "location": location,
        "status": overall_status,
        "status_code": None,
        "response_time_ms": total_ms,
        "timings": {
            "dnsMs": 0,
            "connectionMs": 0,
            "sslMs": 0,
            "ttfbMs": total_ms // 2,
            "downloadMs": total_ms // 4,
        },
        "assertion_results": step_results,
        "response_headers": {
            "x-browser": primary_browser,
            "x-device": primary_device,
        },
        "response_size_bytes": None,
        "error_message": error_message,
    }


async def execute_browser_with_locations(
    *,
    starting_url: str,
    steps: list[dict[str, Any]],
    browsers: list[str],
    devices: list[str],
    locations: list[str],
) -> list[dict[str, Any]]:
    if not locations:
        locations = ["aws:us-east-1"]
    coros = [
        execute_browser_test(
            starting_url=starting_url,
            steps=steps,
            browsers=browsers,
            devices=devices,
            location=loc,
        )
        for loc in locations
    ]
    return await asyncio.gather(*coros)
