"""Datadog-style facet syntax tokenizer.

Parses query strings like:
    "service:api status:error @http.method:POST free text"
into a structured filter dict. Round-trippable to SQL via `queries.py`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable


# Matches `key:value` (value may be quoted, * wildcard, or comma-separated values)
_TOKEN_RE = re.compile(
    r'(?P<key>@?[a-zA-Z_][a-zA-Z0-9_.\-]*):(?P<value>"[^"]*"|\S+)'
)


@dataclass
class ParsedQuery:
    free_text: str = ""
    facets: dict[str, list[str]] = field(default_factory=dict)
    # Reserved attribute filters (@http.method, @error.kind etc.) — kept separate
    # because they live in the JSONB `attributes` column.
    attribute_filters: dict[str, list[str]] = field(default_factory=dict)

    def is_empty(self) -> bool:
        return not (self.free_text or self.facets or self.attribute_filters)


_PROMOTED_FACETS = {"service", "host", "env", "status", "level"}


def parse(query: str | None) -> ParsedQuery:
    if not query:
        return ParsedQuery()
    out = ParsedQuery()
    consumed = []
    for m in _TOKEN_RE.finditer(query):
        key = m.group("key")
        raw_value = m.group("value")
        if raw_value.startswith('"') and raw_value.endswith('"'):
            raw_value = raw_value[1:-1]
        values = [v for v in raw_value.split(",") if v]
        target = (
            out.attribute_filters if key.startswith("@")
            else out.facets
        )
        target.setdefault(key, []).extend(values)
        consumed.append((m.start(), m.end()))
    if consumed:
        # Strip out the matched tokens to leave free-text
        leftover = []
        last = 0
        for s, e in consumed:
            leftover.append(query[last:s])
            last = e
        leftover.append(query[last:])
        out.free_text = " ".join("".join(leftover).split()).strip()
    else:
        out.free_text = query.strip()
    return out


def serialize(parsed: ParsedQuery) -> str:
    """Round-trip back to a single-line query string (best effort)."""
    bits: list[str] = []
    for k, vs in parsed.facets.items():
        bits.append(f"{k}:{','.join(vs)}")
    for k, vs in parsed.attribute_filters.items():
        bits.append(f"{k}:{','.join(vs)}")
    if parsed.free_text:
        bits.append(parsed.free_text)
    return " ".join(bits)
