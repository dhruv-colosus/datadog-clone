"""SQL query builders for telemetry read endpoints.

All queries hit asyncpg directly (via `pool.py`) so they can use TimescaleDB's
`time_bucket` and benefit from the COPY-friendly raw connection layer.
"""

from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
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
class MetricQuerySpec:
    id: str
    metric_name: str
    aggregator: str  # avg | sum | min | max | count
    filters: list[MetricFilter]
    group_by: list[str]
    alias: str = ""


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
        label = f"{spec.aggregator}:{spec.metric_name}{{{','.join(label_parts)}}}"
        series.append({
            "queryId": spec.id,
            "alias": spec.alias or spec.id,
            "label": label,
            "groupTags": group_tags,
            "points": [{"t": t, "value": v} for t, v in pts],
        })
    if not series:
        # Empty result: send back a single empty series so the chart can render
        series.append({
            "queryId": spec.id,
            "alias": spec.alias or spec.id,
            "label": f"{spec.aggregator}:{spec.metric_name}{{*}}",
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


def _logs_where(parsed: ParsedQuery, params: list[Any]) -> str:
    clauses: list[str] = []
    for k, vs in parsed.facets.items():
        if k == "service":
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
            params.extend(vs)
            clauses.append(f"service IN ({ph})")
        elif k == "host":
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
            params.extend(vs)
            clauses.append(f"host IN ({ph})")
        elif k == "env":
            ph = ", ".join(f"${len(params) + i + 1}" for i in range(len(vs)))
            params.extend(vs)
            clauses.append(f"env IN ({ph})")
        elif k in ("status", "level"):
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
    pool = await get_pool()
    params: list[Any] = [_ms_to_dt(from_ms), _ms_to_dt(to_ms)]
    base_where = _logs_where(parsed, params)

    async with pool.acquire() as conn:
        # service facet
        srv_rows = await conn.fetch(
            f"""
            SELECT service AS v, COUNT(*) AS c
            FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {base_where}
            GROUP BY service ORDER BY c DESC LIMIT 20
            """,
            *params,
        )
        # status facet
        st_rows = await conn.fetch(
            f"""
            SELECT status AS v, COUNT(*) AS c
            FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {base_where}
            GROUP BY status ORDER BY c DESC
            """,
            *params,
        )
        # host facet
        host_rows = await conn.fetch(
            f"""
            SELECT host AS v, COUNT(*) AS c
            FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {base_where}
            GROUP BY host ORDER BY c DESC LIMIT 20
            """,
            *params,
        )
        # total
        total_row = await conn.fetchrow(
            f"""
            SELECT COUNT(*) AS c FROM log_lines
            WHERE ts >= $1 AND ts < $2 AND {base_where}
            """,
            *params,
        )

    return {
        "service": [{"value": r["v"], "count": int(r["c"])} for r in srv_rows],
        "status": [
            {"value": _STATUS_CODE_TO_NAME.get(r["v"], "info"), "count": int(r["c"])}
            for r in st_rows
        ],
        "host": [{"value": r["v"], "count": int(r["c"])} for r in host_rows],
        "total": int(total_row["c"] or 0),
    }


# ---------------------------------------------------------------------------
# APM
# ---------------------------------------------------------------------------


async def apm_service_stats(*, env: str | None = None, lookback_seconds: int = 600) -> list[dict[str, Any]]:
    """Per-service rps/error/p95/p99 over the last `lookback_seconds`."""
    pool = await get_pool()
    where = ["ts >= NOW() - $1"]
    params: list[Any] = [dt.timedelta(seconds=lookback_seconds)]
    if env:
        params.append(env)
        where.append(f"env = ${len(params)}")
    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
            s.service,
            COUNT(*) AS hits,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us,
            percentile_disc(0.99) WITHIN GROUP (ORDER BY duration_us) AS p99_us
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
            time_bucket('{step} seconds'::interval, ts) AS b,
            COUNT(*) AS hits,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS errors,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_us) AS p95_us
        FROM spans
        WHERE service = $1 AND ts >= $2 AND ts < $3
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
        }
        for r in rows
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
            "SELECT pid, command, parent_pid, started_seconds_ago "
            "FROM topology_processes WHERE host_id = $1 ORDER BY pid",
            host_id,
        )
    return [
        {
            "pid": r["pid"],
            "command": r["command"],
            "parentPid": r["parent_pid"],
            "startedSecondsAgo": r["started_seconds_ago"],
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
    "apm_get_trace",
    "hosts_with_metrics",
    "host_detail",
    "host_processes",
    "host_containers",
]
