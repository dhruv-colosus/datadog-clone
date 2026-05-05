"""Pipeline processor implementations.

Each processor takes a log dict (with `attributes`, `service`, `host`, `message`,
etc.) and a config dict, and returns a mutated copy. The processor library is
intentionally a small, deterministic subset of Datadog's full set — enough to
demo the pipeline editor end-to-end.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


_GROK_PATTERN_LIB: dict[str, str] = {
    "%{INT}": r"-?\d+",
    "%{NUMBER}": r"-?\d+(\.\d+)?",
    "%{WORD}": r"\w+",
    "%{NOTSPACE}": r"\S+",
    "%{DATA}": r".*?",
    "%{GREEDYDATA}": r".*",
    "%{IP}": r"\d{1,3}(?:\.\d{1,3}){3}",
}


def _expand_grok(pattern: str) -> str:
    out = pattern
    for placeholder, regex in _GROK_PATTERN_LIB.items():
        # Support %{NAME:field}
        named = placeholder.replace("}", r":(\w+)}")
        out = re.sub(named, lambda m, r=regex: f"(?P<{m.group(1)}>{r})", out)
        # Bare %{NAME}
        out = out.replace(placeholder, regex)
    return out


def _set_attr(log: dict[str, Any], path: str, value: Any) -> None:
    attrs = log.setdefault("attributes", {})
    if "." in path:
        head, *rest = path.split(".")
        cur = attrs.setdefault(head, {})
        for k in rest[:-1]:
            cur = cur.setdefault(k, {})
        cur[rest[-1]] = value
    else:
        attrs[path] = value


def _get_attr(log: dict[str, Any], path: str) -> Any:
    if path in log:
        return log[path]
    cur: Any = log.get("attributes", {})
    for k in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def grok_parser(log: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    """Parse `source` attribute (default: message) with grok-style patterns.

    cfg: { source: "message", patterns: ["%{NUMBER:duration} %{WORD:level}"] }
    """
    source = cfg.get("source", "message")
    raw = _get_attr(log, source)
    if raw is None:
        return log
    for pat in cfg.get("patterns", []):
        regex = _expand_grok(pat)
        m = re.search(regex, str(raw))
        if m:
            for k, v in m.groupdict().items():
                _set_attr(log, k, v)
            break
    return log


def date_remapper(log: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    """Reinterpret `source` as a timestamp; copy to log.ts."""
    source = cfg.get("source", "timestamp")
    raw = _get_attr(log, source)
    if raw is None:
        return log
    fmt = cfg.get("format", "iso")
    try:
        if fmt == "iso":
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        elif fmt == "unix_ms":
            dt = datetime.fromtimestamp(int(raw) / 1000, tz=timezone.utc)
        elif fmt == "unix_s":
            dt = datetime.fromtimestamp(int(raw), tz=timezone.utc)
        else:
            dt = datetime.strptime(str(raw), fmt)
        log["ts"] = dt
    except (ValueError, TypeError):
        pass
    return log


def status_remapper(log: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    """Map `source` value to a Syslog severity level (info/warn/error/...)."""
    source = cfg.get("source", "level")
    raw = _get_attr(log, source)
    if raw is None:
        return log
    try:
        n = int(raw)
        # Syslog: 0..7
        levels = ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"]
        if 0 <= n < 8:
            log["status"] = levels[n]
        return log
    except (ValueError, TypeError):
        pass
    s = str(raw).strip().lower()
    if s.startswith("e"):
        log["status"] = "error"
    elif s.startswith("w"):
        log["status"] = "warning"
    elif s.startswith("d"):
        log["status"] = "debug"
    elif s.startswith("c"):
        log["status"] = "critical"
    else:
        log["status"] = "info"
    return log


def message_remapper(log: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    source = cfg.get("source", "message")
    raw = _get_attr(log, source)
    if raw is not None:
        log["message"] = str(raw)
    return log


def service_remapper(log: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    source = cfg.get("source", "service")
    raw = _get_attr(log, source)
    if raw is not None:
        log["service"] = str(raw)
    return log


def attribute_remapper(
    log: dict[str, Any], cfg: dict[str, Any],
) -> dict[str, Any]:
    """Move/copy `source` -> `target`, optionally cast."""
    source = cfg.get("source")
    target = cfg.get("target")
    if not source or not target:
        return log
    raw = _get_attr(log, source)
    if raw is None:
        return log
    cast = cfg.get("cast")
    try:
        if cast == "integer":
            raw = int(raw)
        elif cast == "double":
            raw = float(raw)
        elif cast == "string":
            raw = str(raw)
    except (ValueError, TypeError):
        pass
    _set_attr(log, target, raw)
    return log


def url_parser(log: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    source = cfg.get("source", "http.url")
    raw = _get_attr(log, source)
    if not raw:
        return log
    try:
        u = urlparse(str(raw))
        _set_attr(log, "http.url_details.host", u.hostname or "")
        _set_attr(log, "http.url_details.path", u.path)
        _set_attr(log, "http.url_details.scheme", u.scheme)
        if u.port:
            _set_attr(log, "http.url_details.port", u.port)
        if u.query:
            _set_attr(log, "http.url_details.queryString", u.query)
    except (ValueError, TypeError):
        pass
    return log


def category_processor(
    log: dict[str, Any], cfg: dict[str, Any],
) -> dict[str, Any]:
    """Set `target` attribute based on which `case` matches."""
    target = cfg.get("target", "category")
    for case in cfg.get("cases", []):
        attr = case.get("attribute")
        op = case.get("operator", "equals")
        value = case.get("value")
        actual = _get_attr(log, attr) if attr else None
        if actual is None:
            continue
        if op == "equals" and str(actual) == str(value):
            _set_attr(log, target, case.get("name"))
            return log
        if op == "matches" and re.search(str(value), str(actual)):
            _set_attr(log, target, case.get("name"))
            return log
    return log


def trace_id_remapper(
    log: dict[str, Any], cfg: dict[str, Any],
) -> dict[str, Any]:
    source = cfg.get("source", "trace_id")
    raw = _get_attr(log, source)
    if raw is not None:
        log["trace_id"] = str(raw)
    return log


PROCESSOR_REGISTRY = {
    "grok-parser": grok_parser,
    "date-remapper": date_remapper,
    "status-remapper": status_remapper,
    "service-remapper": service_remapper,
    "message-remapper": message_remapper,
    "attribute-remapper": attribute_remapper,
    "url-parser": url_parser,
    "category-processor": category_processor,
    "trace-id-remapper": trace_id_remapper,
}


def apply_processors(
    log: dict[str, Any], processors: list[dict[str, Any]],
) -> dict[str, Any]:
    out = log
    for p in processors:
        if not p.get("enabled", True):
            continue
        impl = PROCESSOR_REGISTRY.get(p.get("type"))
        if impl is None:
            continue
        try:
            out = impl(out, p.get("config", {}))
        except Exception:  # noqa: BLE001
            pass
    return out
