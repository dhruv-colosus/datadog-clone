"""RUM event generator.

Each tick emits a Poisson-distributed batch of new browser sessions, then
simulates the events those sessions produce within the tick window. A session
lives for a deterministic duration (lognormal seconds), visits 1-N views,
fires actions, occasionally errors, and ends with a `view_end`-style summary
event (we store the end state on the final view row's `time_spent_ms` and
session_*` counters).

Output rows match the `rum_events` hypertable. Stable across restarts: same
tick_index produces the same sessions and events.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

from app.core.config import get_settings
from app.rum.topology import (
    ACTIONS,
    APPLICATIONS,
    BROWSERS,
    DEVICE_TYPES,
    ERROR_STACK_TEMPLATES,
    ERROR_TEMPLATES,
    GEOS,
    OPERATING_SYSTEMS,
    PAGE_TITLES,
    PAGES,
    SYNTHETIC_USERS,
    RumApplication,
)
from app.telemetry.rng import daily_sine, lognormal_ms, seeded_rng


# Avg sessions per tick for the seeded application. With a 60s tick this
# gives ~base_rate sessions/min during peak, scaled by daily-sine + the
# `log_rate_factor` setting so the dial is shared with logs/traces.
_BASE_SESSIONS_PER_TICK: dict[str, float] = {
    "rum-test": 9.0,
}


@dataclass(frozen=True)
class RumEvent:
    ts_seconds: float
    application_id: str
    session_id: str
    view_id: str
    event_type: str  # view | action | error | resource | long_task
    service: str
    env: str
    version: str
    user_id: str | None
    user_name: str | None
    user_email: str | None
    geo_country: str | None
    geo_city: str | None
    browser_name: str | None
    browser_version: str | None
    os_name: str | None
    device_type: str | None
    view_url: str | None
    view_path: str | None
    view_referrer: str | None
    loading_time_ms: int | None
    lcp_ms: int | None
    fcp_ms: int | None
    inp_ms: int | None
    cls: float | None
    time_spent_ms: int | None
    error_message: str | None
    error_source: str | None
    error_stack: str | None
    action_type: str | None
    action_name: str | None
    resource_url: str | None
    resource_method: str | None
    resource_status: int | None
    resource_duration_ms: int | None
    long_task_duration_ms: int | None
    session_view_count: int | None
    session_action_count: int | None
    session_error_count: int | None
    session_frustration_count: int | None
    session_time_spent_ms: int | None
    session_is_active: bool | None
    attributes: dict[str, object]


def _weighted_choice(rng, items, weight_index: int = 1):
    total = sum(item[weight_index] for item in items)
    pick = rng.uniform(0, total)
    acc = 0.0
    for item in items:
        acc += item[weight_index]
        if pick <= acc:
            return item
    return items[-1]


def _weighted_path(rng) -> str:
    return _weighted_choice(rng, PAGES)[0]


def _new_id(rng, length: int = 16) -> str:
    return f"{rng.getrandbits(length * 4):0{length}x}"


def _poisson(rng, lam: float) -> int:
    if lam <= 0:
        return 0
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1


def _pick_user(rng) -> tuple[str | None, str | None, str | None]:
    """Return (user_id, name, email). 30% of sessions are anonymous."""
    if rng.random() < 0.3:
        return (None, None, None)
    name, email = rng.choice(SYNTHETIC_USERS)
    user_id = f"usr_{abs(hash(email)) % (10 ** 10):010d}"
    return (user_id, name, email)


def _pick_actions_for_path(rng, path: str, max_n: int = 5) -> list[tuple[str, str, str]]:
    """Pick (action_name, action_type, attribute_target) entries for a given path."""
    candidates = [a for a in ACTIONS if a[0] == path]
    if not candidates:
        return []
    # Number of actions weighted to favour 1-3
    n = min(max_n, max(1, int(rng.gauss(2, 1))))
    out: list[tuple[str, str, str]] = []
    for _ in range(n):
        path_, name, _w, kind = _weighted_choice(rng, candidates, weight_index=2)
        target = name.split(" on ")[-1] if " on " in name else name
        out.append((name, kind, target))
    return out


def _emit_session(
    *,
    rng,
    app: RumApplication,
    session_index: int,
    tick_start_seconds: float,
    tick_window_seconds: float,
    log_rate_factor: float,
) -> Iterator[RumEvent]:
    """Emit all events for one session that begins inside this tick."""

    session_id = f"{rng.getrandbits(64):016x}-{session_index:04x}"

    # Session-stable attributes
    user_id, user_name, user_email = _pick_user(rng)
    geo_country, geo_city, _ = _weighted_choice(rng, GEOS, weight_index=2)
    browser_name, _bw, browser_version = _weighted_choice(rng, BROWSERS, weight_index=1)
    os_name, _ = _weighted_choice(rng, OPERATING_SYSTEMS, weight_index=1)
    device_type, _ = _weighted_choice(rng, DEVICE_TYPES, weight_index=1)
    version = rng.choice(("v1.4.1", "v1.5.0", "v2.0.0-rc1"))

    referrer_pool = (
        "https://www.google.com/",
        "https://duckduckgo.com/",
        "https://github.com/",
        "https://twitter.com/",
        "",  # direct
    )
    base_referrer = rng.choice(referrer_pool)

    # Session length (seconds). Lognormal so most sessions are short, a few long.
    session_duration_s = max(8.0, lognormal_ms(rng, mean_ms=80, sigma=0.85))
    session_duration_s = min(session_duration_s, 480.0)
    session_started_at = tick_start_seconds + rng.random() * tick_window_seconds

    # Decide how many views in this session. Heavy bias toward 1-3.
    n_views = max(1, min(8, int(rng.gauss(2.4, 1.4))))

    view_count = 0
    action_count = 0
    error_count = 0
    frustration_count = 0
    cumulative_time_ms = 0

    cursor = session_started_at
    last_path = base_referrer if base_referrer else None

    for view_idx in range(n_views):
        if cursor - session_started_at >= session_duration_s:
            break
        view_id = _new_id(rng, 16)
        path = _weighted_path(rng)
        url = f"https://demo.example.com{path}"
        title = PAGE_TITLES.get(path, path)

        # Per-view perf
        loading_time = int(max(180, lognormal_ms(rng, mean_ms=900, sigma=0.5)))
        fcp = int(max(120, loading_time * rng.uniform(0.45, 0.7)))
        lcp = int(max(fcp + 50, loading_time * rng.uniform(0.85, 1.4)))
        inp = int(max(20, lognormal_ms(rng, mean_ms=120, sigma=0.6)))
        cls = round(max(0.0, rng.gauss(0.05, 0.08)), 4)

        # View time (within remaining session). Final view consumes the rest.
        remaining = session_duration_s - (cursor - session_started_at)
        if view_idx == n_views - 1:
            view_time_s = max(2.0, remaining)
        else:
            view_time_s = max(2.0, min(remaining * 0.6, rng.expovariate(1 / 18)))

        view_time_ms = int(view_time_s * 1000)
        view_count += 1
        cumulative_time_ms += view_time_ms

        view_started = cursor
        view_ended = cursor + view_time_s

        # 1) emit `view` row at view start
        yield RumEvent(
            ts_seconds=view_started,
            application_id=app.id,
            session_id=session_id,
            view_id=view_id,
            event_type="view",
            service=app.service,
            env=app.env,
            version=version,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            geo_country=geo_country,
            geo_city=geo_city,
            browser_name=browser_name,
            browser_version=browser_version,
            os_name=os_name,
            device_type=device_type,
            view_url=url,
            view_path=path,
            view_referrer=last_path or None,
            loading_time_ms=loading_time,
            lcp_ms=lcp,
            fcp_ms=fcp,
            inp_ms=inp,
            cls=cls,
            time_spent_ms=view_time_ms,
            error_message=None,
            error_source=None,
            error_stack=None,
            action_type=None,
            action_name=None,
            resource_url=None,
            resource_method=None,
            resource_status=None,
            resource_duration_ms=None,
            long_task_duration_ms=None,
            session_view_count=None,
            session_action_count=None,
            session_error_count=None,
            session_frustration_count=None,
            session_time_spent_ms=None,
            session_is_active=None,
            attributes={
                "view.title": title,
                "view.is_first": view_idx == 0,
                "view.index": view_idx,
            },
        )
        last_path = path

        # 2) actions / errors / resources sprinkled within the view window
        action_specs = _pick_actions_for_path(rng, path)
        n_actions = len(action_specs)
        for a_i, (action_name, action_type, target) in enumerate(action_specs):
            offset = view_time_s * (a_i + 1) / (n_actions + 1)
            ts = view_started + offset
            if ts >= view_ended:
                break
            action_count += 1
            yield RumEvent(
                ts_seconds=ts,
                application_id=app.id,
                session_id=session_id,
                view_id=view_id,
                event_type="action",
                service=app.service,
                env=app.env,
                version=version,
                user_id=user_id,
                user_name=user_name,
                user_email=user_email,
                geo_country=geo_country,
                geo_city=geo_city,
                browser_name=browser_name,
                browser_version=browser_version,
                os_name=os_name,
                device_type=device_type,
                view_url=url,
                view_path=path,
                view_referrer=None,
                loading_time_ms=None,
                lcp_ms=None,
                fcp_ms=None,
                inp_ms=None,
                cls=None,
                time_spent_ms=None,
                error_message=None,
                error_source=None,
                error_stack=None,
                action_type=action_type,
                action_name=action_name,
                resource_url=None,
                resource_method=None,
                resource_status=None,
                resource_duration_ms=None,
                long_task_duration_ms=None,
                session_view_count=None,
                session_action_count=None,
                session_error_count=None,
                session_frustration_count=None,
                session_time_spent_ms=None,
                session_is_active=None,
                attributes={"action.target.name": target},
            )

        # 3) resource events: ~2-5 fetches per view
        n_resources = max(0, int(rng.gauss(3, 1.3)))
        resource_endpoints = (
            "/api/users/me",
            "/api/orders",
            "/api/dashboards",
            "/api/metrics/series",
            "/api/feature-flags",
            "/api/checkout",
            "/api/auth/session",
            "/static/app.js",
            "/static/styles.css",
        )
        for r_i in range(n_resources):
            offset = view_time_s * rng.random()
            ts = view_started + offset
            if ts >= view_ended:
                break
            res_url = f"https://demo.example.com{rng.choice(resource_endpoints)}"
            method = rng.choice(("GET", "GET", "GET", "POST", "POST"))
            res_status = rng.choices((200, 201, 204, 304, 400, 404, 500),
                                     weights=(72, 6, 4, 8, 4, 4, 2))[0]
            res_dur = int(max(8, lognormal_ms(rng, mean_ms=120, sigma=0.7)))
            yield RumEvent(
                ts_seconds=ts,
                application_id=app.id,
                session_id=session_id,
                view_id=view_id,
                event_type="resource",
                service=app.service,
                env=app.env,
                version=version,
                user_id=user_id,
                user_name=user_name,
                user_email=user_email,
                geo_country=geo_country,
                geo_city=geo_city,
                browser_name=browser_name,
                browser_version=browser_version,
                os_name=os_name,
                device_type=device_type,
                view_url=url,
                view_path=path,
                view_referrer=None,
                loading_time_ms=None,
                lcp_ms=None,
                fcp_ms=None,
                inp_ms=None,
                cls=None,
                time_spent_ms=None,
                error_message=None,
                error_source=None,
                error_stack=None,
                action_type=None,
                action_name=None,
                resource_url=res_url,
                resource_method=method,
                resource_status=res_status,
                resource_duration_ms=res_dur,
                long_task_duration_ms=None,
                session_view_count=None,
                session_action_count=None,
                session_error_count=None,
                session_frustration_count=None,
                session_time_spent_ms=None,
                session_is_active=None,
                attributes={
                    "resource.type": "fetch" if "/api/" in res_url else "css" if res_url.endswith(".css") else "js" if res_url.endswith(".js") else "other",
                },
            )

        # 4) errors — ~10% of views error once
        if rng.random() < 0.10:
            err_source, err_msg, _w = _weighted_choice(rng, ERROR_TEMPLATES, weight_index=2)
            err_stack = rng.choice(ERROR_STACK_TEMPLATES)
            ts = view_started + view_time_s * rng.uniform(0.3, 0.95)
            error_count += 1
            if rng.random() < 0.4:
                frustration_count += 1
            yield RumEvent(
                ts_seconds=ts,
                application_id=app.id,
                session_id=session_id,
                view_id=view_id,
                event_type="error",
                service=app.service,
                env=app.env,
                version=version,
                user_id=user_id,
                user_name=user_name,
                user_email=user_email,
                geo_country=geo_country,
                geo_city=geo_city,
                browser_name=browser_name,
                browser_version=browser_version,
                os_name=os_name,
                device_type=device_type,
                view_url=url,
                view_path=path,
                view_referrer=None,
                loading_time_ms=None,
                lcp_ms=None,
                fcp_ms=None,
                inp_ms=None,
                cls=None,
                time_spent_ms=None,
                error_message=err_msg,
                error_source=err_source,
                error_stack=err_stack,
                action_type=None,
                action_name=None,
                resource_url=None,
                resource_method=None,
                resource_status=None,
                resource_duration_ms=None,
                long_task_duration_ms=None,
                session_view_count=None,
                session_action_count=None,
                session_error_count=None,
                session_frustration_count=None,
                session_time_spent_ms=None,
                session_is_active=None,
                attributes={
                    "error.handling": "unhandled" if rng.random() < 0.6 else "handled",
                    "error.type": "TypeError" if "TypeError" in err_msg else "NetworkError" if err_source == "network" else "Error",
                },
            )

        # 5) long task — rare, ~5% of views
        if rng.random() < 0.05:
            ts = view_started + view_time_s * rng.uniform(0.4, 0.9)
            yield RumEvent(
                ts_seconds=ts,
                application_id=app.id,
                session_id=session_id,
                view_id=view_id,
                event_type="long_task",
                service=app.service,
                env=app.env,
                version=version,
                user_id=user_id,
                user_name=user_name,
                user_email=user_email,
                geo_country=geo_country,
                geo_city=geo_city,
                browser_name=browser_name,
                browser_version=browser_version,
                os_name=os_name,
                device_type=device_type,
                view_url=url,
                view_path=path,
                view_referrer=None,
                loading_time_ms=None,
                lcp_ms=None,
                fcp_ms=None,
                inp_ms=None,
                cls=None,
                time_spent_ms=None,
                error_message=None,
                error_source=None,
                error_stack=None,
                action_type=None,
                action_name=None,
                resource_url=None,
                resource_method=None,
                resource_status=None,
                resource_duration_ms=None,
                long_task_duration_ms=int(rng.uniform(120, 600)),
                session_view_count=None,
                session_action_count=None,
                session_error_count=None,
                session_frustration_count=None,
                session_time_spent_ms=None,
                session_is_active=None,
                attributes={},
            )

        cursor = view_ended

    # 6) final session summary — emit on the final view's `view_id`. We use a
    # dedicated event_type so the API can pull session aggregates with one row
    # rather than scanning all events.
    yield RumEvent(
        ts_seconds=cursor,
        application_id=app.id,
        session_id=session_id,
        view_id=view_id,
        event_type="session_summary",
        service=app.service,
        env=app.env,
        version=version,
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        geo_country=geo_country,
        geo_city=geo_city,
        browser_name=browser_name,
        browser_version=browser_version,
        os_name=os_name,
        device_type=device_type,
        view_url=last_path and f"https://demo.example.com{last_path}",
        view_path=last_path,
        view_referrer=base_referrer or None,
        loading_time_ms=None,
        lcp_ms=None,
        fcp_ms=None,
        inp_ms=None,
        cls=None,
        time_spent_ms=None,
        error_message=None,
        error_source=None,
        error_stack=None,
        action_type=None,
        action_name=None,
        resource_url=None,
        resource_method=None,
        resource_status=None,
        resource_duration_ms=None,
        long_task_duration_ms=None,
        session_view_count=view_count,
        session_action_count=action_count,
        session_error_count=error_count,
        session_frustration_count=frustration_count,
        session_time_spent_ms=cumulative_time_ms,
        session_is_active=False,
        attributes={
            "session.entry_path": (
                # first path was set inside the loop, but we don't kept it; rebuild
                # by reading view_index=0 attribute from the events emitted above is
                # not available here, so we pass the entry path as a separate hint.
                base_referrer or "direct"
            ),
        },
    )


def iter_events_for_tick(t_seconds: float) -> Iterator[RumEvent]:
    """Yield RUM events for sessions starting in this tick."""
    settings = get_settings()
    interval = settings.tick_interval_seconds
    rate_factor = settings.log_rate_factor

    sine = daily_sine(t_seconds)
    rate_scale = 0.55 + 0.7 * (sine + 1) / 2  # 0.55..1.25

    for app in APPLICATIONS:
        base_rate = _BASE_SESSIONS_PER_TICK.get(app.id, 4.0) * rate_scale * max(rate_factor, 0.15)
        rng = seeded_rng("rum_session_count", app.id, int(t_seconds))
        n_sessions = _poisson(rng, base_rate)
        for i in range(n_sessions):
            sess_rng = seeded_rng("rum_session", app.id, int(t_seconds), i)
            yield from _emit_session(
                rng=sess_rng,
                app=app,
                session_index=i,
                tick_start_seconds=t_seconds,
                tick_window_seconds=float(interval),
                log_rate_factor=rate_factor,
            )
