"""Source-of-truth fixture for RUM synthesis.

Mirrors the spirit of `app/telemetry/topology.py` but for browser-side RUM:
we declare the seeded RUM applications, the page catalog, the user pool, and
the browser/geo distributions. The generator in
`app/telemetry/generators/rum.py` reads these constants so every restart
produces identical RUM history.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RumApplication:
    id: str
    name: str
    type: str  # react | angular | vue | vanilla
    service: str  # ties to topology.py services (web | api | …)
    env: str
    client_token: str


# Single seeded application matching the screenshots ("Test" / React).
APPLICATIONS: tuple[RumApplication, ...] = (
    RumApplication(
        id="rum-test",
        name="Test",
        type="react",
        service="web",
        env="prod",
        client_token="pubdemoo0clienttoken1234567890ab",
    ),
)


# (path, weight) — heavier weight = more traffic. Mirrors the marketing-style
# routes the `web` service exposes in the telemetry topology log generator.
PAGES: tuple[tuple[str, float], ...] = (
    ("/", 18.0),
    ("/dashboard", 12.0),
    ("/pricing", 6.0),
    ("/settings", 4.0),
    ("/account/billing", 2.5),
    ("/checkout", 3.0),
    ("/login", 5.0),
    ("/signup", 3.0),
    ("/docs", 4.0),
    ("/blog", 2.0),
)

PAGE_TITLES: dict[str, str] = {
    "/": "Demo Inc — Home",
    "/dashboard": "Dashboard",
    "/pricing": "Pricing",
    "/settings": "Settings",
    "/account/billing": "Billing",
    "/checkout": "Checkout",
    "/login": "Sign in",
    "/signup": "Create account",
    "/docs": "Docs",
    "/blog": "Blog",
}


# Browser distribution (name, weight, latest version).
BROWSERS: tuple[tuple[str, float, str], ...] = (
    ("Chrome", 60.0, "124.0.0.0"),
    ("Safari", 18.0, "17.4"),
    ("Edge", 10.0, "124.0.2478.51"),
    ("Firefox", 8.0, "126.0"),
    ("Opera", 2.0, "109.0"),
    ("Samsung Internet", 2.0, "24.0"),
)

OPERATING_SYSTEMS: tuple[tuple[str, float], ...] = (
    ("Mac OS", 35.0),
    ("Windows", 38.0),
    ("iOS", 12.0),
    ("Android", 10.0),
    ("Linux", 5.0),
)

DEVICE_TYPES: tuple[tuple[str, float], ...] = (
    ("desktop", 78.0),
    ("mobile", 18.0),
    ("tablet", 4.0),
)

# (country, city, weight). Matches the "Country" filter shown in the summary
# header — these end up populating the country dropdown and the geo facet.
GEOS: tuple[tuple[str, str, float], ...] = (
    ("United States", "New York", 22.0),
    ("United States", "San Francisco", 14.0),
    ("United States", "Austin", 6.0),
    ("United Kingdom", "London", 8.0),
    ("Germany", "Berlin", 6.0),
    ("France", "Paris", 5.0),
    ("Canada", "Toronto", 4.0),
    ("India", "Bangalore", 12.0),
    ("India", "Mumbai", 5.0),
    ("Japan", "Tokyo", 6.0),
    ("Brazil", "São Paulo", 4.0),
    ("Australia", "Sydney", 3.0),
    ("Netherlands", "Amsterdam", 2.0),
    ("Singapore", "Singapore", 3.0),
)


# Synthetic user pool — names + emails are chosen at session-creation time and
# stick across that session's events. `None` slot represents an anonymous user.
SYNTHETIC_USERS: tuple[tuple[str, str], ...] = (
    ("Maya Patel", "maya.patel@example.com"),
    ("Liam Chen", "liam.chen@example.com"),
    ("Sofia Garcia", "sofia.garcia@example.com"),
    ("Noah Williams", "noah.williams@example.com"),
    ("Aisha Khan", "aisha.khan@example.com"),
    ("Jonas Müller", "jonas.muller@example.com"),
    ("Hina Sato", "hina.sato@example.com"),
    ("Ethan O'Brien", "ethan.obrien@example.com"),
    ("Carla Ribeiro", "carla.ribeiro@example.com"),
    ("Tom Anderson", "tom.anderson@example.com"),
    ("Priya Sharma", "priya.sharma@example.com"),
    ("Lucas Martin", "lucas.martin@example.com"),
)


# Action / interaction catalog per page — drives the actions table, click
# heatmaps, and the session replay timeline. Tuples are (path, action_name,
# weight, action_type).
ACTIONS: tuple[tuple[str, str, float, str], ...] = (
    ("/", "click on Get started CTA", 6.0, "click"),
    ("/", "click on Watch demo", 3.0, "click"),
    ("/", "scroll to footer", 2.0, "scroll"),
    ("/dashboard", "click on New widget", 8.0, "click"),
    ("/dashboard", "click on Time range picker", 5.0, "click"),
    ("/dashboard", "click on Save dashboard", 2.0, "click"),
    ("/dashboard", "type in search input", 4.0, "input"),
    ("/pricing", "click on Choose plan — Pro", 3.0, "click"),
    ("/pricing", "click on Compare plans", 2.0, "click"),
    ("/settings", "click on Save changes", 3.0, "click"),
    ("/settings", "click on API keys tab", 2.0, "click"),
    ("/checkout", "click on Pay now", 4.0, "click"),
    ("/checkout", "click on Apply coupon", 1.0, "click"),
    ("/login", "click on Sign in", 7.0, "click"),
    ("/login", "click on Forgot password", 1.5, "click"),
    ("/signup", "click on Create account", 5.0, "click"),
    ("/account/billing", "click on Update card", 1.5, "click"),
    ("/docs", "click on Search docs", 3.0, "click"),
    ("/docs", "click on Copy code block", 2.0, "click"),
    ("/blog", "click on Article card", 2.5, "click"),
)


# Common error templates we'll seed. Each error inherits the active page +
# session context so the explorer's group-by surfaces them naturally.
ERROR_TEMPLATES: tuple[tuple[str, str, float], ...] = (
    ("source", "TypeError: Cannot read properties of undefined (reading 'id')", 4.0),
    ("source", "ReferenceError: dataLayer is not defined", 2.0),
    ("network", "Failed to fetch /api/orders", 3.0),
    ("network", "Failed to fetch /api/users/me — 500 Internal Server Error", 1.5),
    ("network", "Network request timed out — POST /api/checkout", 1.0),
    ("source", "ChunkLoadError: Loading chunk 17 failed", 1.0),
    ("custom", "Unhandled promise rejection: AbortError", 1.5),
    ("source", "TypeError: undefined is not a function", 1.0),
)


ERROR_STACK_TEMPLATES: tuple[str, ...] = (
    "TypeError\n    at handleClick (app.js:142:23)\n    at HTMLButtonElement.onClick (Button.tsx:48:9)\n    at dispatchEvent (react-dom.js:1234:11)",
    "TypeError\n    at fetchData (api.ts:88:14)\n    at async loadDashboard (Dashboard.tsx:24:5)\n    at async useEffect (Dashboard.tsx:18:3)",
    "Error: 500 Internal Server Error\n    at parseResponse (fetch-utils.ts:34:11)\n    at async fetchOrders (api.ts:212:15)",
)


def applications() -> tuple[RumApplication, ...]:
    return APPLICATIONS


def app_by_id(application_id: str) -> RumApplication | None:
    for a in APPLICATIONS:
        if a.id == application_id:
            return a
    return None


def default_application() -> RumApplication:
    return APPLICATIONS[0]
