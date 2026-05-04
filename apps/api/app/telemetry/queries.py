"""SQL query builders for telemetry read endpoints.

All queries hit asyncpg directly (via `pool.py`) so they can use TimescaleDB's
`time_bucket` and benefit from the COPY-friendly raw connection layer.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from dataclasses import dataclass, field
from typing import Any, Iterable

from app.telemetry.parser import ParsedQuery, parse
from app.telemetry.pool import get_pool


# Frontend always sends millisecond timestamps. Helpers convert.
def _ms_to_dt(ms: int) -> dt.datetime:
    return dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc)


def _step_seconds(from_ms: int, to_ms: int, target_points: int = 120) -> int:
    span_s = max(1, (to_ms - from_ms) // 1000)
    raw = max(1, span_s // target_points)
    # Snap to friendly buckets
    for s in (5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200, 21600, 86400):
        if raw <= s:
            return s
    return raw


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


@dataclass
class MetricFilter:
    tag: str
    operator: str  # "in" | "not in"
    values: list[str]


@dataclass
class MetricFunctionStep:
    """A function to apply to each series after SQL aggregation.

    Mirrors the frontend `FunctionStep` discriminator: `kind` is one of
    rate | derivative | rollup | as_count | as_rate | cumulative_sum |
    integral | abs | log2 | log10. `method`/`interval_seconds` are only
    populated for rollup.
    """

    kind: str
    method: str | None = None
    interval_seconds: int | None = None


@dataclass
class MetricQuerySpec:
    id: str
    metric_name: str
    aggregator: str  # avg | sum | min | max | count
    filters: list[MetricFilter]
    group_by: list[str]
    alias: str = ""
    functions: list[MetricFunctionStep] = field(default_factory=list)


_PROMOTED_TAG_COLUMNS = {"host", "service", "env", "name"}
_AGG_FN = {
    "avg": "AVG(value)",
    "sum": "SUM(value)",
    "min": "MIN(value)",
    "max": "MAX(value)",
    "count": "COUNT(*)::float8",
}


def _filter_to_sql(
    flt: MetricFilter, params: list[Any]
) -> str:
    op = "IN" if flt.operator == "in" else "NOT IN"
    if flt.tag in _PROMOTED_TAG_COLUMNS:
        ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(flt.values)))
        params.extend(flt.values)
        return f"{flt.tag} {op} ({ph})"
    # JSONB tag
    ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(flt.values)))
    params.extend(flt.values)
    return f"(tags ->> '{flt.tag}') {op} ({ph})"


def _group_expr(g: str) -> str:
    if g in _PROMOTED_TAG_COLUMNS:
        return g
    return f"(tags ->> '{g}')"


def _apply_function(
    points: list[tuple[int, float]],
    fn: MetricFunctionStep,
) -> list[tuple[int, float]]:
    """Apply one function step to a series. Mirrors Datadog semantics.

    Pure: takes (t_ms, value) pairs and returns transformed pairs. Functions
    that need the time delta (rate/derivative/integral) compute it from the
    timestamps directly so they remain correct after a `rollup` reshapes the
    bucket spacing earlier in the chain.
    """
    if not points:
        return points

    if fn.kind in ("rate", "derivative"):
        # dy/dt per second between consecutive points; first point drops out.
        out: list[tuple[int, float]] = []
        for i in range(1, len(points)):
            t_prev, v_prev = points[i - 1]
            t_now, v_now = points[i]
            dt_s = max(1e-9, (t_now - t_prev) / 1000.0)
            out.append((t_now, (v_now - v_prev) / dt_s))
        return out

    if fn.kind == "rollup":
        interval_s = max(1, fn.interval_seconds or 60)
        method = fn.method or "avg"
        bucket_ms = interval_s * 1000
        buckets: dict[int, list[float]] = {}
        for t, v in points:
            b = (t // bucket_ms) * bucket_ms
            buckets.setdefault(b, []).append(v)
        out = []
        for b in sorted(buckets):
            vals = buckets[b]
            if method == "sum":
                out.append((b, sum(vals)))
            elif method == "min":
                out.append((b, min(vals)))
            elif method == "max":
                out.append((b, max(vals)))
            elif method == "count":
                out.append((b, float(len(vals))))
            else:  # avg (default)
                out.append((b, sum(vals) / len(vals)))
        return out

    if fn.kind == "cumulative_sum":
        out = []
        running = 0.0
        for t, v in points:
            running += v
            out.append((t, running))
        return out

    if fn.kind == "integral":
        # Trapezoidal integral over time, in seconds.
        out = []
        running = 0.0
        for i in range(1, len(points)):
            t_prev, v_prev = points[i - 1]
            t_now, v_now = points[i]
            dt_s = (t_now - t_prev) / 1000.0
            running += 0.5 * (v_prev + v_now) * dt_s
            out.append((t_now, running))
        return out

    if fn.kind == "abs":
        return [(t, abs(v)) for t, v in points]

    if fn.kind == "log2":
        return [(t, math.log2(v)) for t, v in points if v > 0]

    if fn.kind == "log10":
        return [(t, math.log10(v)) for t, v in points if v > 0]

    # as_count / as_rate are no-ops here — they only affect how the storage
    # backend interprets the underlying counter, which our schema doesn't
    # distinguish. Pass through unchanged so the function pill still shows.
    return points


def _decorate_label(base_label: str, functions: list[MetricFunctionStep]) -> str:
    """Wrap label with applied functions, e.g. derivative(avg:foo{*})."""
    label = base_label
    for fn in functions:
        if fn.kind == "rollup":
            interval = fn.interval_seconds or 60
            method = fn.method or "avg"
            label = f"rollup({label}, {method}, {interval})"
        elif fn.kind == "cumulative_sum":
            label = f"cumsum({label})"
        else:
            label = f"{fn.kind}({label})"
    return label


async def query_metric_series(
    *,
    spec: MetricQuerySpec,
    from_ms: int,
    to_ms: int,
    step_seconds: int | None = None,
) -> list[dict[str, Any]]:
    """Returns a list of series: {label, group_tags, points: [(t_ms, value)]}."""
    pool = await get_pool()
    step = step_seconds or _step_seconds(from_ms, to_ms)
    agg_sql = _AGG_FN.get(spec.aggregator, _AGG_FN["avg"])

    where_clauses: list[str] = ["name = $1", "ts >= $2", "ts < $3"]
    params: list[Any] = [spec.metric_name, _ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    for flt in spec.filters:
        if not flt.values:
            continue
        where_clauses.append(_filter_to_sql(flt, params))

    where = " AND ".join(where_clauses)
    group_exprs = [
        f"{_group_expr(g)} AS grp_{i}" for i, g in enumerate(spec.group_by)
    ]
    group_select = (", " + ", ".join(group_exprs)) if group_exprs else ""
    group_by_sql = (
        ", " + ", ".join(f"grp_{i}" for i in range(len(spec.group_by)))
        if spec.group_by else ""
    )

    sql = f"""
        SELECT
            time_bucket('{step} seconds'::interval, ts) AS bucket,
            {agg_sql} AS value
            {group_select}
        FROM metric_points
        WHERE {where}
        GROUP BY bucket{group_by_sql}
        ORDER BY bucket
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    grouped: dict[tuple, list[tuple[int, float]]] = {}
    for row in rows:
        key = tuple(row[f"grp_{i}"] for i in range(len(spec.group_by)))
        bucket: dt.datetime = row["bucket"]
        ts_ms = int(bucket.timestamp() * 1000)
        grouped.setdefault(key, []).append((ts_ms, float(row["value"])))

    series: list[dict[str, Any]] = []
    for key, pts in grouped.items():
        group_tags = {g: v for g, v in zip(spec.group_by, key) if v is not None}
        if group_tags:
            label_parts = [f"{k}:{v}" for k, v in group_tags.items()]
        else:
            label_parts = ["*"]
        base_label = (
            f"{spec.aggregator}:{spec.metric_name}{{{','.join(label_parts)}}}"
        )
        for fn in spec.functions:
            pts = _apply_function(pts, fn)
        label = _decorate_label(base_label, spec.functions)
        series.append({
            "queryId": spec.id,
            "alias": spec.alias or spec.id,
            "label": label,
            "groupTags": group_tags,
            "points": [{"t": t, "value": v} for t, v in pts],
        })
    if not series:
        # Empty result: send back a single empty series so the chart can render
        empty_label = _decorate_label(
            f"{spec.aggregator}:{spec.metric_name}{{*}}", spec.functions
        )
        series.append({
            "queryId": spec.id,
            "alias": spec.alias or spec.id,
            "label": empty_label,
            "groupTags": {},
            "points": [],
        })
    return series


async def metric_names(prefix: str | None = None) -> list[str]:
    pool = await get_pool()
    sql = "SELECT name FROM metric_catalog"
    args: tuple = ()
    if prefix:
        sql += " WHERE name LIKE $1"
        args = (f"{prefix}%",)
    sql += " ORDER BY name"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [r["name"] for r in rows]


async def metric_tag_keys(metric: str | None) -> list[str]:
    """For a given metric, list which tag keys are populated in metric_points."""
    pool = await get_pool()
    static_keys: list[str] = ["host", "service", "env"]
    sql = "SELECT key FROM tag_catalog ORDER BY key"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
    return list(static_keys) + [r["key"] for r in rows if r["key"] not in static_keys]


async def metric_tag_values(metric: str | None, tag: str) -> list[str]:
    pool = await get_pool()
    if tag in _PROMOTED_TAG_COLUMNS:
        col = tag if tag != "name" else "name"
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT DISTINCT {col} AS v FROM metric_points "
                f"WHERE {col} IS NOT NULL ORDER BY {col}"
            )
        return [r["v"] for r in rows]
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT values FROM tag_catalog WHERE key = $1", tag)
    return list(row["values"]) if row else []


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------


_STATUS_NAME_TO_CODE = {"info": 0, "warn": 1, "error": 2, "debug": 3}
_STATUS_CODE_TO_NAME = {v: k for k, v in _STATUS_NAME_TO_CODE.items()}


def _logs_where(
    parsed: ParsedQuery,
    params: list[Any],
    *,
    exclude: set[str] | None = None,
) -> str:
    """Build a SQL WHERE clause from a parsed query.

    `exclude` lists facet dimensions to skip when building filters — used by the
    facets endpoint so each facet's counts reflect every filter EXCEPT its own
    (otherwise selecting "service:api" would hide every other service from the
    facet panel, breaking multi-select).
    """
    skip = exclude or set()
    clauses: list[str] = []
    for k, vs in parsed.facets.items():
        if k == "service":
            if "service" in skip:
                continue
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
            params.extend(vs)
            clauses.append(f"service IN ({ph})")
        elif k == "host":
            if "host" in skip:
                continue
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
            params.extend(vs)
            clauses.append(f"host IN ({ph})")
        elif k == "env":
            if "env" in skip:
                continue
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
            params.extend(vs)
            clauses.append(f"env IN ({ph})")
        elif k in ("status", "level"):
            if "status" in skip:
                continue
            codes = [_STATUS_NAME_TO_CODE.get(v, -1) for v in vs]
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(codes)))
            params.extend(codes)
            clauses.append(f"status IN ({ph})")
    for k, vs in parsed.attribute_filters.items():
        # @http.method etc. — JSONB
        ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
        params.extend(vs)
        clauses.append(f"(attributes ->> '{k}') IN ({ph})")
    if parsed.free_text:
        params.append(f"%{parsed.free_text}%")
        clauses.append(f"message ILIKE ${len(params)}")
    return " AND ".join(clauses) if clauses else "TRUE"


async def search_logs(
    *,
    parsed: ParsedQuery,
    from_ms: int,
    to_ms: int,
    limit: int = 200,
) -> list[dict[str, Any]]:
    pool = await get_pool()
    params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    base_where = _logs_where(parsed, params)
    sql = f"""
        SELECT ts, service, host, env, status, message, attributes,
               trace_id, span_id
        FROM log_lines
        WHERE ts >= $1 AND ts < $2 AND {base_where}
        ORDER BY ts DESC
        LIMIT {int(limit)}
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return [
        {
            "id": f"{int(r['ts'].timestamp() * 1_000_000)}-{r['service']}-{idx}",
            "timestampMs": int(r["ts"].timestamp() * 1000),
            "host": r["host"],
            "service": r["service"],
            "status": _STATUS_CODE_TO_NAME.get(r["status"], "info"),
            "content": r["message"],
            "attributes": json.loads(r["attributes"]) if isinstance(r["attributes"], str) else (r["attributes"] or {}),
            "traceId": r["trace_id"],
            "spanId": r["span_id"],
        }
        for idx, r in enumerate(rows)
    ]


async def logs_histogram(
    *,
    parsed: ParsedQuery,
    from_ms: int,
    to_ms: int,
    bucket_seconds: int | None = None,
) -> list[dict[str, Any]]:
    pool = await get_pool()
    params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    base_where = _logs_where(parsed, params)
    bucket = bucket_seconds or _step_seconds(from_ms, to_ms, target_points=80)

    sql = f"""
        SELECT
            time_bucket('{bucket} seconds'::interval, ts) AS b,
            SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS info,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS warn,
            SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS error
        FROM log_lines
        WHERE ts >= $1 AND ts < $2 AND {base_where}
        GROUP BY b
        ORDER BY b
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    return [
        {
            "t": int(r["b"].timestamp() * 1000),
            "info": int(r["info"] or 0),
            "warn": int(r["warn"] or 0),
            "error": int(r["error"] or 0),
        }
        for r in rows
    ]


async def logs_facets(
    *,
    parsed: ParsedQuery,
    from_ms: int,
    to_ms: int,
) -> dict[str, Any]:
    """Per-facet counts for the logs facet panel.

    The list of values for each facet comes from the unfiltered universe in the
    time range — toggling other filters never makes a value disappear, it just
    drops its count to zero. (Datadog's behaviour: if you deselect "error" and
    `auth` has no errors, `auth` still shows in the panel with `0`.)

    Counts come from a separate aggregation that applies every filter EXCEPT
    the facet's own (so multi-select still works). The `total` reflects the
    full filter and feeds the page-level "X logs" headline.
    """
    pool = await get_pool()

    def _build(exclude: set[str] | None):
        params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
        where = _logs_where(parsed, params, exclude=exclude)
        return params, where

    range_params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]

    async with pool.acquire() as conn:
        # --- universes (distinct values in the time range, no filters) ---
        srv_universe = await conn.fetch(
            "SELECT DISTINCT service FROM log_lines WHERE ts >= $1 AND ts < $2",
            *range_params,
        )
        host_universe = await conn.fetch(
            "SELECT DISTINCT host FROM log_lines WHERE ts >= $1 AND ts < $2",
            *range_params,
        )
        # status universe is the closed set {info, warn, error} — no DB query needed
        status_universe_codes = [0, 1, 2]

        # --- filtered counts (every filter except the facet's own) ---
        params, where = _build({"service"})
        srv_count_rows = await conn.fetch(
            f"""
            SELECT service AS v, COUNT(*) AS c
            FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {where}
            GROUP BY service
            """,
            *params,
        )
        params, where = _build({"status"})
        st_count_rows = await conn.fetch(
            f"""
            SELECT status AS v, COUNT(*) AS c
            FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {where}
            GROUP BY status
            """,
            *params,
        )
        params, where = _build({"host"})
        host_count_rows = await conn.fetch(
            f"""
            SELECT host AS v, COUNT(*) AS c
            FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {where}
            GROUP BY host
            """,
            *params,
        )

        # --- total — every filter applied ---
        params, where = _build(None)
        total_row = await conn.fetchrow(
            f"""
            SELECT COUNT(*) AS c FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {where}
            """,
            *params,
        )

    # Stitch universes ⨝ counts (default 0 for values with no matches under
    # current filters — they stay visible in the panel so the user can flip
    # the filter back on).
    srv_counts = {r["v"]: int(r["c"]) for r in srv_count_rows}
    services = sorted(
        ({"value": r["service"], "count": srv_counts.get(r["service"], 0)}
         for r in srv_universe),
        key=lambda x: (-x["count"], x["value"]),
    )[:20]

    st_counts = {int(r["v"]): int(r["c"]) for r in st_count_rows}
    statuses = sorted(
        (
            {
                "value": _STATUS_CODE_TO_NAME.get(code, "info"),
                "count": st_counts.get(code, 0),
            }
            for code in status_universe_codes
        ),
        key=lambda x: -x["count"],
    )

    host_counts = {r["v"]: int(r["c"]) for r in host_count_rows}
    hosts = sorted(
        ({"value": r["host"], "count": host_counts.get(r["host"], 0)}
         for r in host_universe),
        key=lambda x: (-x["count"], x["value"]),
    )[:20]

    return {
        "service": services,
        "status": statuses,
        "host": hosts,
        "total": int(total_row["c"] or 0),
    }


# ---------------------------------------------------------------------------
# Log patterns + transactions (group-by views)
# ---------------------------------------------------------------------------


# Pattern template = the message with variable bits replaced by `*`. We chain
# regexp_replace passes in order from most-specific to least-specific (IPs
# before generic digit runs, hex IDs before generic digits) so an IPv4 doesn't
# turn into `*.*.*.*` before we get to it. Datadog's "patterns" view does
# something similar — collapses high-cardinality variables so structurally
# identical lines fall into one group.
#
# Each tuple is (regex, replacement). Applied left → right. Built into the
# nested `regexp_replace(regexp_replace(message, r1, ''), r2, '')...` form
# below so we get a single SQL expression usable in GROUP BY.
_PATTERN_REPLACEMENTS: list[tuple[str, str]] = [
    (r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '*'),     # IPv4
    (r'/[A-Za-z0-9_\-]+(?:/[A-Za-z0-9_\-]+)+', '/*'), # paths /a/b/c
    (r'"[^"]*"', '"*"'),                              # quoted strings
    (r'\m[0-9a-f]{8,}\M', '*'),                       # hex/UUID-ish IDs
    (r'\d+', '*'),                                    # remaining digit runs
]


def _pattern_template_sql(column: str = "message") -> str:
    expr = column
    for regex, repl in _PATTERN_REPLACEMENTS:
        # Single-quote-escape (PG strings) — none of these regexes contain `'`
        # but stay safe.
        regex_sql = regex.replace("'", "''")
        repl_sql = repl.replace("'", "''")
        expr = f"regexp_replace({expr}, '{regex_sql}', '{repl_sql}', 'g')"
    return expr


_PATTERN_TEMPLATE_SQL = _pattern_template_sql("message")


# Dimensions the user is allowed to add to GROUP BY in patterns/transactions.
# Matches the doc-known facets shown in Datadog's query builder.
_GROUPABLE_DIMS = {"service", "status", "host", "env"}


def _normalize_group_by(group_by: list[str] | None) -> list[str]:
    """Drop unknown dims and de-dupe while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for g in group_by or []:
        if g in _GROUPABLE_DIMS and g not in seen:
            seen.add(g)
            out.append(g)
    return out


def _sparkline_buckets(from_ms: int, to_ms: int, target: int = 16) -> int:
    """Pick a bucket width that gives ~`target` bins for a sparkline."""
    span_s = max(1, (to_ms - from_ms) // 1000)
    raw = max(1, span_s // target)
    for s in (5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200, 21600, 86400):
        if raw <= s:
            return s
    return raw


async def logs_patterns(
    *,
    parsed: ParsedQuery,
    from_ms: int,
    to_ms: int,
    group_by: list[str] | None = None,
    limit: int = 25,
) -> list[dict[str, Any]]:
    """Group log lines by message template and return the most common templates.

    Respects the request's filters (service/status/host/free-text/attributes)
    so toggling a facet narrows the pattern list. `group_by` adds extra
    dimensions to the GROUP BY (e.g. ["status","service"] splits one template
    into per-status, per-service rows — that's how Datadog's "by Status by
    Service" chips work).

    Service/status not in `group_by` collapse via mode()/MAX so they still
    appear in the result row (you always need *some* status/service to render).

    `volume` is a real per-bucket sparkline (~16 bins) for each pattern row,
    so the table can draw a meaningful trend instead of a flat baseline.
    """
    pool = await get_pool()
    group_by = _normalize_group_by(group_by)

    # Build per-row select/group fragments. service & status are special
    # because they always appear in the result — either as GROUP BY columns
    # (when in group_by) or as aggregates (when not).
    if "service" in group_by:
        svc_select = "service AS service"
    else:
        svc_select = "mode() WITHIN GROUP (ORDER BY service) AS service"
    if "status" in group_by:
        status_select = "status AS status"
    else:
        status_select = "MAX(status) AS status"

    extras = [g for g in group_by if g not in ("service", "status")]
    extras_select = "".join(f", {g} AS {g}" for g in extras)

    group_clauses = ["template"]
    if "service" in group_by:
        group_clauses.append("service")
    if "status" in group_by:
        group_clauses.append("status")
    group_clauses.extend(extras)
    group_sql = ", ".join(group_clauses)

    params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    where = _logs_where(parsed, params)

    sql_top = f"""
        SELECT
            {_PATTERN_TEMPLATE_SQL} AS template,
            COUNT(*) AS c,
            {svc_select},
            {status_select}
            {extras_select}
        FROM log_lines
        WHERE ts >= $1 AND ts < $2 AND {where}
        GROUP BY {group_sql}
        ORDER BY c DESC
        LIMIT {int(limit)}
    """

    bucket_s = _sparkline_buckets(from_ms, to_ms, target=16)

    # Per-bucket histogram for ALL groups in the time range. We keyed by the
    # same dims as the top query so we can join in Python without a second
    # round-trip per row. (Cardinality is bounded by the GROUP BY dims, so
    # this stays small even for 1d windows.)
    bin_select_extras: list[str] = []
    bin_group_extras: list[str] = []
    if "service" in group_by:
        bin_select_extras.append("service")
        bin_group_extras.append("service")
    if "status" in group_by:
        bin_select_extras.append("status")
        bin_group_extras.append("status")
    for g in extras:
        bin_select_extras.append(g)
        bin_group_extras.append(g)

    bin_extras_sql = (
        ", " + ", ".join(bin_select_extras) if bin_select_extras else ""
    )
    bin_extras_group_sql = (
        ", " + ", ".join(bin_group_extras) if bin_group_extras else ""
    )

    sql_bin = f"""
        SELECT
            time_bucket('{bucket_s} seconds'::interval, ts) AS b,
            {_PATTERN_TEMPLATE_SQL} AS template,
            COUNT(*) AS c
            {bin_extras_sql}
        FROM log_lines
        WHERE ts >= $1 AND ts < $2 AND {where}
        GROUP BY b, template{bin_extras_group_sql}
    """

    async with pool.acquire() as conn:
        top_rows = await conn.fetch(sql_top, *params)
        bin_rows = await conn.fetch(sql_bin, *params) if top_rows else []

    # Build the bucket axis once so every row has the same length sparkline.
    if bin_rows:
        bucket_set = sorted({int(r["b"].timestamp() * 1000) for r in bin_rows})
        bucket_index = {b: i for i, b in enumerate(bucket_set)}
    else:
        bucket_set, bucket_index = [], {}

    def _key_top(r: Any) -> tuple:
        parts: list[Any] = [r["template"]]
        if "service" in group_by:
            parts.append(("service", r["service"]))
        if "status" in group_by:
            parts.append(("status", int(r["status"])))
        for g in extras:
            parts.append((g, r[g]))
        return tuple(parts)

    def _key_bin(r: Any) -> tuple:
        parts: list[Any] = [r["template"]]
        if "service" in group_by:
            parts.append(("service", r["service"]))
        if "status" in group_by:
            parts.append(("status", int(r["status"])))
        for g in extras:
            parts.append((g, r[g]))
        return tuple(parts)

    bin_map: dict[tuple, list[int]] = {}
    for r in bin_rows:
        k = _key_bin(r)
        if k not in bin_map:
            bin_map[k] = [0] * len(bucket_set)
        bin_map[k][bucket_index[int(r["b"].timestamp() * 1000)]] = int(r["c"])

    out: list[dict[str, Any]] = []
    for i, r in enumerate(top_rows):
        k = _key_top(r)
        volume = bin_map.get(k, [])
        peak = max(volume) if volume else int(r["c"])
        groups: dict[str, str] = {}
        for g in extras:
            v = r[g]
            if v is not None:
                groups[g] = str(v)
        out.append({
            "id": f"pattern-{i}",
            "count": int(r["c"]),
            "volume": volume,
            "volumePeak": peak,
            "status": _STATUS_CODE_TO_NAME.get(int(r["status"]), "info"),
            "service": r["service"],
            "message": r["template"],
            "groups": groups,
        })
    return out


async def logs_transactions(
    *,
    parsed: ParsedQuery,
    from_ms: int,
    to_ms: int,
    group_by: list[str] | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Group log lines by trace_id (+ optional dims) — each group is a transaction.

    Default GROUP BY is just trace_id (one row per trace). Adding "service"
    or "host" to group_by splits a trace that spans services/hosts into
    sub-rows — matching how Datadog's "by Status by Service" chips behave.

    Returns real per-bucket `timeline` (~16 bins) so the sparkline column
    renders an actual trend instead of an empty placeholder.
    """
    pool = await get_pool()
    group_by = _normalize_group_by(group_by)

    if "service" in group_by:
        svc_select = "service AS service"
    else:
        svc_select = "mode() WITHIN GROUP (ORDER BY service) AS service"
    if "status" in group_by:
        status_select = "status AS status"
    else:
        status_select = "MAX(status) AS status"

    extras = [g for g in group_by if g not in ("service", "status")]
    extras_select = "".join(f", {g} AS {g}" for g in extras)

    group_clauses = ["trace_id"]
    if "service" in group_by:
        group_clauses.append("service")
    if "status" in group_by:
        group_clauses.append("status")
    group_clauses.extend(extras)
    group_sql = ", ".join(group_clauses)

    params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    where = _logs_where(parsed, params)

    sql_top = f"""
        SELECT
            trace_id,
            COUNT(*) AS c,
            {svc_select},
            {status_select},
            MIN(ts) AS first_ts,
            MAX(ts) AS last_ts
            {extras_select}
        FROM log_lines
        WHERE ts >= $1 AND ts < $2 AND {where}
          AND trace_id IS NOT NULL
        GROUP BY {group_sql}
        ORDER BY c DESC
        LIMIT {int(limit)}
    """

    bucket_s = _sparkline_buckets(from_ms, to_ms, target=16)

    bin_select_extras: list[str] = []
    bin_group_extras: list[str] = []
    if "service" in group_by:
        bin_select_extras.append("service")
        bin_group_extras.append("service")
    if "status" in group_by:
        bin_select_extras.append("status")
        bin_group_extras.append("status")
    for g in extras:
        bin_select_extras.append(g)
        bin_group_extras.append(g)

    bin_extras_sql = (
        ", " + ", ".join(bin_select_extras) if bin_select_extras else ""
    )
    bin_extras_group_sql = (
        ", " + ", ".join(bin_group_extras) if bin_group_extras else ""
    )

    sql_bin = f"""
        SELECT
            time_bucket('{bucket_s} seconds'::interval, ts) AS b,
            trace_id,
            COUNT(*) AS c
            {bin_extras_sql}
        FROM log_lines
        WHERE ts >= $1 AND ts < $2 AND {where}
          AND trace_id IS NOT NULL
        GROUP BY b, trace_id{bin_extras_group_sql}
    """

    async with pool.acquire() as conn:
        top_rows = await conn.fetch(sql_top, *params)
        bin_rows = await conn.fetch(sql_bin, *params) if top_rows else []

    if bin_rows:
        bucket_set = sorted({int(r["b"].timestamp() * 1000) for r in bin_rows})
        bucket_index = {b: i for i, b in enumerate(bucket_set)}
    else:
        bucket_set, bucket_index = [], {}

    def _key_top(r: Any) -> tuple:
        parts: list[Any] = [r["trace_id"]]
        if "service" in group_by:
            parts.append(("service", r["service"]))
        if "status" in group_by:
            parts.append(("status", int(r["status"])))
        for g in extras:
            parts.append((g, r[g]))
        return tuple(parts)

    def _key_bin(r: Any) -> tuple:
        parts: list[Any] = [r["trace_id"]]
        if "service" in group_by:
            parts.append(("service", r["service"]))
        if "status" in group_by:
            parts.append(("status", int(r["status"])))
        for g in extras:
            parts.append((g, r[g]))
        return tuple(parts)

    bin_map: dict[tuple, list[int]] = {}
    for r in bin_rows:
        k = _key_bin(r)
        if k not in bin_map:
            bin_map[k] = [0] * len(bucket_set)
        bin_map[k][bucket_index[int(r["b"].timestamp() * 1000)]] = int(r["c"])

    out: list[dict[str, Any]] = []
    for r in top_rows:
        k = _key_top(r)
        timeline = bin_map.get(k, [])
        peak = max(timeline) if timeline else int(r["c"])
        duration_ms = int((r["last_ts"] - r["first_ts"]).total_seconds() * 1000)
        status_name = _STATUS_CODE_TO_NAME.get(int(r["status"]), "info")
        groups: dict[str, str] = {}
        for g in extras:
            v = r[g]
            if v is not None:
                groups[g] = str(v)
        # Make the row id stable across renders: trace_id alone collides when
        # we split a trace by service/status, so suffix the group dims.
        row_id = r["trace_id"]
        if group_by:
            suffix = "/".join(str(r[g]) for g in group_by if r[g] is not None)
            if suffix:
                row_id = f"{r['trace_id']}/{suffix}"
        out.append({
            "id": row_id,
            "traceId": r["trace_id"],
            "status": status_name,
            "service": r["service"],
            "timeline": timeline,
            "timelinePeak": peak,
            "durationMs": duration_ms,
            "maxSeverity": status_name,
            "count": int(r["c"]),
            "groups": groups,
        })
    return out


# ---------------------------------------------------------------------------
# APM
# ---------------------------------------------------------------------------


async def apm_service_stats(*, env: str | None = None, lookback_seconds: int = 600) -> list[dict[str, Any]]:
    """Per-service rps/error/p50/p95/p99 over the last `lookback_seconds`.

    Counts spans that represent entries into the service: a span where the
    parent is NULL (root) or where the parent span lives on a different
    service (cross-service hop). This avoids double-counting internal child
    spans within the same service while still surfacing downstream services
    like postgres / redis / auth that never have null-parent spans.
    """
    pool = await get_pool()
    # Use a concrete timestamp parameter rather than `NOW() - INTERVAL` so
    # asyncpg can infer the type unambiguously when $1 is referenced inside
    # the NOT EXISTS subquery on the same hypertable.
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=lookback_seconds)
    where = ["s.ts >= $1"]
    params: list[Any] = [cutoff]
    if env:
        params.append(env)
        where.append(f"s.env = ${len(params)}")
    where.append(
        "(s.parent_span_id IS NULL OR NOT EXISTS ("
        "  SELECT 1 FROM spans p"
        "   WHERE p.trace_id = s.trace_id"
        "     AND p.span_id = s.parent_span_id"
        "     AND p.service = s.service"
        "     AND p.ts >= $1"
        "))"
    )
    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
            s.service,
            COUNT(*) AS hits,
            SUM(CASE WHEN s.status = 1 THEN 1 ELSE 0 END) AS errors,
            percentile_disc(0.50) WITHIN GROUP (ORDER BY s.duration_us) AS p50_us,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY s.duration_us) AS p95_us,
            percentile_disc(0.99) WITHIN GROUP (ORDER BY s.duration_us) AS p99_us
        FROM spans s
        WHERE {where_sql}
        GROUP BY s.service
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    out: list[dict[str, Any]] = []
    for r in rows:
        hits = int(r["hits"] or 0)
        errors = int(r["errors"] or 0)
        out.append({
            "name": r["service"],
            "hits": hits,
            "errors": errors,
            "rps": hits / max(1, lookback_seconds),
            "errorRate": (errors / hits) if hits else 0.0,
            "p50LatencyMs": float(r["p50_us"] or 0) / 1000.0,
            "p95LatencyMs": float(r["p95_us"] or 0) / 1000.0,
            "p99LatencyMs": float(r["p99_us"] or 0) / 1000.0,
        })
    return out


async def apm_service_series(
    *,
    service: str,
    from_ms: int,
    to_ms: int,
    step_seconds: int | None = None,
) -> list[dict[str, Any]]:
    pool = await get_pool()
    step = step_seconds or _step_seconds(from_ms, to_ms)
    sql = f"""
        SELECT
            time_bucket('{step} seconds'::interval, s.ts) AS b,
            COUNT(*) AS hits,
            SUM(CASE WHEN s.status = 1 THEN 1 ELSE 0 END) AS errors,
            percentile_disc(0.50) WITHIN GROUP (ORDER BY s.duration_us) AS p50_us,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY s.duration_us) AS p95_us,
            percentile_disc(0.99) WITHIN GROUP (ORDER BY s.duration_us) AS p99_us
        FROM spans s
        WHERE s.service = $1 AND s.ts >= $2 AND s.ts < $3
          AND (s.parent_span_id IS NULL OR NOT EXISTS (
              SELECT 1 FROM spans p
              WHERE p.trace_id = s.trace_id
                AND p.span_id = s.parent_span_id
                AND p.service = s.service
                AND p.ts >= $2 AND p.ts < $3
          ))
        GROUP BY b ORDER BY b
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, service, _ms_to_dt(from_ms), _ms_to_dt(to_ms))
    return [
        {
            "t": int(r["b"].timestamp() * 1000),
            "hits": int(r["hits"] or 0),
            "errors": int(r["errors"] or 0),
            "latencyMs": float(r["p95_us"] or 0) / 1000.0,
            "p50Ms": float(r["p50_us"] or 0) / 1000.0,
            "p95Ms": float(r["p95_us"] or 0) / 1000.0,
            "p99Ms": float(r["p99_us"] or 0) / 1000.0,
        }
        for r in rows
    ]


async def apm_search_spans(
    *,
    from_ms: int,
    to_ms: int,
    services: list[str] | None = None,
    statuses: list[str] | None = None,
    resources: list[str] | None = None,
    env: str | None = None,
    free_text: str = "",
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Search spans for the Traces explorer table.

    Returns the most recent spans within the time range that match every
    filter. The response shape mirrors the existing frontend `ApmSpan` type
    so the UI can drop the mock-data layer.
    """
    pool = await get_pool()
    where = ["ts >= $1", "ts < $2"]
    params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    if services:
        ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(services)))
        params.extend(services)
        where.append(f"service IN ({ph})")
    if resources:
        ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(resources)))
        params.extend(resources)
        where.append(f"resource IN ({ph})")
    if statuses:
        codes = [1 if s == "error" else 0 for s in statuses]
        ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(codes)))
        params.extend(codes)
        where.append(f"status IN ({ph})")
    if env:
        params.append(env)
        where.append(f"env = ${len(params)}")
    if free_text.strip():
        params.append(f"%{free_text.strip()}%")
        where.append(
            f"(resource ILIKE ${len(params)} OR service ILIKE ${len(params)} "
            f"OR operation ILIKE ${len(params)})"
        )
    where_sql = " AND ".join(where)

    sql = f"""
        SELECT ts, trace_id, span_id, parent_span_id, service, operation,
               resource, duration_us, status, http_method, http_status,
               host, env
        FROM spans
        WHERE {where_sql}
        ORDER BY ts DESC
        LIMIT {int(limit)}
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return [
        {
            "id": r["span_id"],
            "spanId": r["span_id"],
            "traceId": r["trace_id"],
            "parentSpanId": r["parent_span_id"],
            "timestampMs": int(r["ts"].timestamp() * 1000),
            "service": r["service"],
            "operation": r["operation"],
            "resource": r["resource"],
            "durationMs": int(r["duration_us"]) / 1000.0,
            "method": r["http_method"],
            "statusCode": r["http_status"],
            "status": "error" if r["status"] == 1 else "ok",
            "host": r["host"],
            "env": r["env"],
        }
        for r in rows
    ]


async def apm_span_facets(
    *,
    from_ms: int,
    to_ms: int,
    services: list[str] | None = None,
    statuses: list[str] | None = None,
    resources: list[str] | None = None,
    env: str | None = None,
    free_text: str = "",
) -> dict[str, Any]:
    """Per-facet counts for the Traces facet panel.

    Each facet's counts apply every filter EXCEPT the facet's own — so
    deselecting "service:api" still shows other services with non-zero
    counts (matches Datadog's multi-select behaviour).
    """
    pool = await get_pool()

    def _build(exclude: set[str]) -> tuple[list[Any], str]:
        where = ["ts >= $1", "ts < $2"]
        params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
        if services and "service" not in exclude:
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(services)))
            params.extend(services)
            where.append(f"service IN ({ph})")
        if resources and "resource" not in exclude:
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(resources)))
            params.extend(resources)
            where.append(f"resource IN ({ph})")
        if statuses and "status" not in exclude:
            codes = [1 if s == "error" else 0 for s in statuses]
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(codes)))
            params.extend(codes)
            where.append(f"status IN ({ph})")
        if env and "env" not in exclude:
            params.append(env)
            where.append(f"env = ${len(params)}")
        if free_text.strip():
            params.append(f"%{free_text.strip()}%")
            where.append(
                f"(resource ILIKE ${len(params)} OR service ILIKE ${len(params)} "
                f"OR operation ILIKE ${len(params)})"
            )
        return params, " AND ".join(where)

    async with pool.acquire() as conn:
        p, w = _build({"service"})
        svc_rows = await conn.fetch(
            f"SELECT service AS v, COUNT(*) AS c FROM spans WHERE {w} GROUP BY service",
            *p,
        )
        p, w = _build({"resource"})
        res_rows = await conn.fetch(
            f"SELECT resource AS v, COUNT(*) AS c FROM spans WHERE {w} "
            f"GROUP BY resource ORDER BY c DESC LIMIT 50",
            *p,
        )
        p, w = _build({"status"})
        st_rows = await conn.fetch(
            f"SELECT status AS v, COUNT(*) AS c FROM spans WHERE {w} GROUP BY status",
            *p,
        )
        p, w = _build({"env"})
        env_rows = await conn.fetch(
            f"SELECT env AS v, COUNT(*) AS c FROM spans WHERE {w} GROUP BY env",
            *p,
        )
        p, w = _build(set())
        total_row = await conn.fetchrow(
            f"SELECT COUNT(*) AS c FROM spans WHERE {w}", *p
        )

    sort_desc = lambda x: -x["count"]
    status_universe = [{"value": "ok", "count": 0}, {"value": "error", "count": 0}]
    st_counts = {int(r["v"]): int(r["c"]) for r in st_rows}
    for s in status_universe:
        s["count"] = st_counts.get(1 if s["value"] == "error" else 0, 0)

    return {
        "service": sorted(
            [{"value": r["v"], "count": int(r["c"])} for r in svc_rows],
            key=sort_desc,
        ),
        "resource": sorted(
            [{"value": r["v"], "count": int(r["c"])} for r in res_rows],
            key=sort_desc,
        ),
        "status": sorted(status_universe, key=sort_desc),
        "env": sorted(
            [{"value": r["v"], "count": int(r["c"])} for r in env_rows],
            key=sort_desc,
        ),
        "total": int(total_row["c"] or 0),
    }


async def apm_service_map(
    *,
    env: str | None = None,
    lookback_seconds: int = 600,
) -> dict[str, Any]:
    """Service map: per-service stats + per-edge call counts.

    Edges come from observed parent→child span pairs in the lookback window
    (joined to themselves), so the map reflects *real* recent traffic, not
    just the static topology.
    """
    pool = await get_pool()

    where = ["ts >= NOW() - $1"]
    params: list[Any] = [dt.timedelta(seconds=lookback_seconds)]
    if env:
        params.append(env)
        where.append(f"env = ${len(params)}")
    where_sql = " AND ".join(where)

    nodes_sql = f"""
        SELECT
            service,
            COUNT(*) FILTER (WHERE parent_span_id IS NULL) AS entry_hits,
            COUNT(*) AS hits,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us
        FROM spans
        WHERE {where_sql}
        GROUP BY service
    """

    edges_sql = f"""
        SELECT parent.service AS caller, child.service AS callee,
               COUNT(*) AS calls,
               SUM(CASE WHEN child.status = 1 THEN 1 ELSE 0 END) AS errors
        FROM spans child
        JOIN spans parent
          ON child.parent_span_id = parent.span_id
         AND child.trace_id = parent.trace_id
        WHERE child.{where_sql.replace("ts", "child.ts")}
          AND parent.service <> child.service
        GROUP BY parent.service, child.service
    """

    async with pool.acquire() as conn:
        node_rows = await conn.fetch(nodes_sql, *params)
        edge_rows = await conn.fetch(edges_sql, *params)

    nodes = []
    for r in node_rows:
        hits = int(r["hits"] or 0)
        errors = int(r["errors"] or 0)
        nodes.append({
            "service": r["service"],
            "hits": hits,
            "errors": errors,
            "errorRate": (errors / hits) if hits else 0.0,
            "rps": int(r["entry_hits"] or 0) / max(1, lookback_seconds),
            "p95LatencyMs": float(r["p95_us"] or 0) / 1000.0,
        })

    edges = [
        {
            "caller": r["caller"],
            "callee": r["callee"],
            "calls": int(r["calls"] or 0),
            "errors": int(r["errors"] or 0),
        }
        for r in edge_rows
    ]
    return {"nodes": nodes, "edges": edges}


async def apm_resource_top_series(
    *,
    service: str,
    from_ms: int,
    to_ms: int,
    top_n: int = 5,
    step_seconds: int | None = None,
) -> list[dict[str, Any]]:
    """Time-series for the top-N resources of a service (by hit count).

    Used by the resources tab's three-up requests/latency/errors charts.
    """
    pool = await get_pool()
    step = step_seconds or _step_seconds(from_ms, to_ms)

    async with pool.acquire() as conn:
        top_rows = await conn.fetch(
            """
            SELECT resource, COUNT(*) AS c
            FROM spans
            WHERE service = $1 AND ts >= $2 AND ts < $3
            GROUP BY resource ORDER BY c DESC LIMIT $4
            """,
            service, _ms_to_dt(from_ms), _ms_to_dt(to_ms), top_n,
        )
        if not top_rows:
            return []
        top_resources = [r["resource"] for r in top_rows]
        ph = ", ".join(f"${i + 4}" for i in range(len(top_resources)))
        rows = await conn.fetch(
            f"""
            SELECT
                resource,
                time_bucket('{step} seconds'::interval, ts) AS b,
                COUNT(*) AS hits,
                SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
                percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us
            FROM spans
            WHERE service = $1 AND ts >= $2 AND ts < $3
              AND resource IN ({ph})
            GROUP BY resource, b ORDER BY resource, b
            """,
            service, _ms_to_dt(from_ms), _ms_to_dt(to_ms), *top_resources,
        )

    by_resource: dict[str, list[dict[str, Any]]] = {r: [] for r in top_resources}
    for r in rows:
        by_resource.setdefault(r["resource"], []).append({
            "t": int(r["b"].timestamp() * 1000),
            "hits": int(r["hits"] or 0),
            "errors": int(r["errors"] or 0),
            "latencyMs": float(r["p95_us"] or 0) / 1000.0,
        })
    return [
        {"service": resource, "points": pts}
        for resource, pts in by_resource.items()
    ]


async def apm_get_trace(trace_id: str) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ts, trace_id, span_id, parent_span_id, service, operation,
                   resource, duration_us, status, http_method, http_status,
                   host, env, tags
            FROM spans
            WHERE trace_id = $1
            ORDER BY ts
            """,
            trace_id,
        )
    return [
        {
            "tsMs": int(r["ts"].timestamp() * 1000),
            "traceId": r["trace_id"],
            "spanId": r["span_id"],
            "parentSpanId": r["parent_span_id"],
            "service": r["service"],
            "operation": r["operation"],
            "resource": r["resource"],
            "durationMs": int(r["duration_us"]) / 1000.0,
            "status": "error" if r["status"] == 1 else "ok",
            "httpMethod": r["http_method"],
            "httpStatus": r["http_status"],
            "host": r["host"],
            "env": r["env"],
            "tags": json.loads(r["tags"]) if isinstance(r["tags"], str) else (r["tags"] or {}),
        }
        for r in rows
    ]


async def apm_watchdog_anomalies(*, lookback_hours: int = 48) -> list[dict[str, Any]]:
    """Detect APM error-rate anomalies as 5-minute buckets where error rate
    exceeded 10% of bucket traffic. Returns one entry per (service, resource)
    spike, sorted most-recent-first, with a 16-point sparkline of error rate
    over the lookback window."""
    pool = await get_pool()
    bucket = 300  # 5 minutes
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=lookback_hours)
    sql = f"""
        WITH buckets AS (
            SELECT
                time_bucket('{bucket} seconds'::interval, ts) AS b,
                service, resource,
                COUNT(*) AS hits,
                SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errs
            FROM spans
            WHERE ts >= $1
            GROUP BY b, service, resource
        )
        SELECT b, service, resource, hits, errs,
               (errs::float8 / NULLIF(hits, 0)) AS rate
        FROM buckets
        WHERE errs > 0 AND hits >= 3 AND (errs::float8 / hits) >= 0.10
        ORDER BY b DESC
        LIMIT 20
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, cutoff)
    if not rows:
        return []

    # Build a 16-point sparkline of overall error rate over the window
    points_sql = f"""
        SELECT time_bucket('{bucket} seconds'::interval, ts) AS b,
               COUNT(*) AS hits,
               SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errs
        FROM spans
        WHERE ts >= $1
        GROUP BY b ORDER BY b
    """
    async with pool.acquire() as conn:
        prows = await conn.fetch(points_sql, cutoff)
    points = [
        {
            "t": int(r["b"].timestamp() * 1000),
            "hits": int(r["hits"] or 0),
            "errors": int(r["errs"] or 0),
            "rate": (float(r["errs"]) / float(r["hits"])) if r["hits"] else 0.0,
        }
        for r in prows
    ]

    out: list[dict[str, Any]] = []
    for r in rows:
        peak = float(r["rate"] or 0.0)
        out.append({
            "id": f"wd_{int(r['b'].timestamp())}_{r['service']}_{abs(hash(r['resource'])) % 10000}",
            "kind": "APM ERROR RATE",
            "status": "resolved",
            "title": f"Error rate increased on the {r['resource']} resource",
            "service": r["service"],
            "resource": r["resource"],
            "startedMs": int(r["b"].timestamp() * 1000),
            "endedMs": int(r["b"].timestamp() * 1000) + bucket * 1000,
            "peakRate": peak,
            "hits": int(r["hits"] or 0),
            "errors": int(r["errs"] or 0),
            "points": points,
        })
    return out


async def apm_issues(*, lookback_seconds: int = 3600, limit: int = 20) -> list[dict[str, Any]]:
    """Aggregate error spans by (service, resource) over the lookback window.
    Used by the APM home Issues panel. Returns most recent error timestamp
    plus error count per issue."""
    pool = await get_pool()
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=lookback_seconds)
    sql = """
        SELECT
            service,
            resource,
            COUNT(*) AS error_count,
            MAX(ts) AS last_seen,
            MIN(ts) AS first_seen,
            COALESCE(MAX(http_status), 0) AS http_status
        FROM spans
        WHERE ts >= $1 AND status = 1
        GROUP BY service, resource
        ORDER BY error_count DESC, last_seen DESC
        LIMIT $2
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, cutoff, limit)
    out: list[dict[str, Any]] = []
    for r in rows:
        last = r["last_seen"]
        first = r["first_seen"]
        out.append({
            "id": f"iss_{r['service']}_{abs(hash(r['resource'])) % 100000}",
            "service": r["service"],
            "resource": r["resource"],
            "errorCount": int(r["error_count"] or 0),
            "lastSeenMs": int(last.timestamp() * 1000) if last else None,
            "firstSeenMs": int(first.timestamp() * 1000) if first else None,
            "httpStatus": int(r["http_status"] or 0) or None,
        })
    return out


# ---------------------------------------------------------------------------
# Infrastructure
# ---------------------------------------------------------------------------


async def hosts_with_metrics(env: str | None = None) -> list[dict[str, Any]]:
    """Top-level host listing combined with their latest CPU/load values."""
    pool = await get_pool()
    where = []
    params: list[Any] = []
    if env:
        params.append(env)
        where.append(f"env = ${len(params)}")
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""
    async with pool.acquire() as conn:
        host_rows = await conn.fetch(
            f"SELECT * FROM topology_hosts {where_sql} ORDER BY hostname"
        )
        # Latest cpu.user per host within last 10m
        cpu_rows = await conn.fetch(
            """
            SELECT DISTINCT ON (host) host, value, ts
            FROM metric_points
            WHERE name = 'system.cpu.user' AND ts >= NOW() - INTERVAL '10 minutes'
            ORDER BY host, ts DESC
            """
        )
    cpu_by_host = {r["host"]: float(r["value"]) for r in cpu_rows if r["host"]}
    return [_host_row_to_dict(r, cpu_by_host) for r in host_rows]


def _host_row_to_dict(r: Any, cpu_by_host: dict[str, float]) -> dict[str, Any]:
    return {
        "id": r["id"],
        "hostname": r["hostname"],
        "role": r["role"],
        "service": r["service"],
        "env": r["env"],
        "region": r["region"],
        "availabilityZone": r["availability_zone"],
        "os": r["os"],
        "cpuPercent": cpu_by_host.get(r["id"], 0.0),
        "agentVersion": r["agent_version"],
        "cpuCores": r["cpu_cores"],
        "memoryGB": float(r["memory_gb"]),
        "filesystemGB": float(r["filesystem_gb"]),
        "ipAddress": r["ip_address"],
        "ipv6Address": r["ipv6_address"],
        "macAddress": r["mac_address"],
        "kernelRelease": r["kernel_release"],
        "kernelVersion": r["kernel_version"],
        "dockerVersion": r["docker_version"],
        "apps": list(r["apps"] or []),
        "kubeClusterName": r["kube_cluster_name"],
        "kubeNamespace": r["kube_namespace"],
        "version": r["version"],
        "team": r["team"],
        "status": r["status"],
    }


async def host_detail(host_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        host_row = await conn.fetchrow(
            "SELECT * FROM topology_hosts WHERE id = $1", host_id
        )
        if host_row is None:
            return None
        cpu_row = await conn.fetchrow(
            """
            SELECT value FROM metric_points
            WHERE name = 'system.cpu.user' AND host = $1
            ORDER BY ts DESC LIMIT 1
            """,
            host_id,
        )
    cpu = float(cpu_row["value"]) if cpu_row else 0.0
    detail = _host_row_to_dict(host_row, {host_id: cpu})
    return detail


async def host_processes(host_id: str) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT pid, command, parent_pid, started_seconds_ago, "
            "       cpu_percent, rss_mib "
            "FROM topology_processes WHERE host_id = $1 "
            "ORDER BY rss_mib DESC, pid",
            host_id,
        )
    return [
        {
            "pid": r["pid"],
            "command": r["command"],
            "parentPid": r["parent_pid"],
            "startedSecondsAgo": r["started_seconds_ago"],
            "cpuPercent": float(r["cpu_percent"]),
            "rssMib": r["rss_mib"],
        }
        for r in rows
    ]


async def host_containers(host_id: str) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT name, image, runtime, started_seconds_ago "
            "FROM topology_containers WHERE host_id = $1 ORDER BY name",
            host_id,
        )
    return [
        {
            "name": r["name"],
            "image": r["image"],
            "runtime": r["runtime"],
            "startedSecondsAgo": r["started_seconds_ago"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------


__all__ = [
    "MetricFilter",
    "MetricQuerySpec",
    "query_metric_series",
    "metric_names",
    "metric_tag_keys",
    "metric_tag_values",
    "search_logs",
    "logs_histogram",
    "logs_facets",
    "apm_service_stats",
    "apm_service_series",
    "apm_search_spans",
    "apm_span_facets",
    "apm_service_map",
    "apm_resource_top_series",
    "apm_get_trace",
    "hosts_with_metrics",
    "host_detail",
    "host_processes",
    "host_containers",
]
