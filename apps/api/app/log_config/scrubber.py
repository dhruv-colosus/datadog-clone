"""Sensitive Data Scrubber.

Library patterns + custom regex; matches replaced inline in log message and
attribute values. Each match is persisted as a finding for the Findings page.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from typing import Any


LIBRARY_PATTERNS: dict[str, dict[str, str]] = {
    "us_ssn": {
        "label": "US Social Security Number",
        "regex": r"\b\d{3}-\d{2}-\d{4}\b",
    },
    "credit_card_visa": {
        "label": "Credit Card (Visa)",
        "regex": r"\b4\d{3}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b",
    },
    "credit_card_mastercard": {
        "label": "Credit Card (Mastercard)",
        "regex": r"\b5[1-5]\d{2}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b",
    },
    "email": {
        "label": "Email address",
        "regex": r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b",
    },
    "ipv4": {
        "label": "IPv4 address",
        "regex": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
    },
    "aws_access_key": {
        "label": "AWS Access Key",
        "regex": r"\bAKIA[0-9A-Z]{16}\b",
    },
    "jwt": {
        "label": "JWT token",
        "regex": r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b",
    },
    "phone_us": {
        "label": "US phone number",
        "regex": r"\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b",
    },
    "uuid": {
        "label": "UUID",
        "regex": r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    },
    "stripe_secret": {
        "label": "Stripe secret key",
        "regex": r"\bsk_live_[A-Za-z0-9]{24}\b",
    },
}


def _hash_match(s: str) -> str:
    h = hashlib.sha256(s.encode()).hexdigest()[:12]
    return f"<hash:{h}>"


def _replace(match: str, strategy: str) -> str:
    if strategy == "hash":
        return _hash_match(match)
    if strategy == "partial_redact":
        if len(match) <= 4:
            return "*" * len(match)
        return match[:2] + "*" * (len(match) - 4) + match[-2:]
    return "[REDACTED]"


def _scrub_text(
    text: str,
    rules: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    out = text
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        pattern_kind = rule.get("pattern_kind", "library")
        if pattern_kind == "library":
            lib = LIBRARY_PATTERNS.get(rule.get("library_pattern_id", ""))
            if not lib:
                continue
            regex_str = lib["regex"]
            label = lib["label"]
        else:
            regex_str = rule.get("custom_regex") or ""
            label = rule.get("name") or "custom"
        if not regex_str:
            continue
        try:
            regex = re.compile(regex_str)
        except re.error:
            continue
        strategy = rule.get("replacement_strategy", "redact")

        def replace_fn(m: re.Match[str]) -> str:
            findings.append({
                "rule_id": rule["id"],
                "pattern_matched": label,
                "excerpt_redacted": _replace(m.group(0), strategy),
            })
            return _replace(m.group(0), strategy)

        out = regex.sub(replace_fn, out)
    return out, findings


def scrub_log(
    log: dict[str, Any],
    rules: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Scrub the message + string-valued attributes. Returns (log, findings)."""
    if not rules:
        return log, []
    out = dict(log)
    findings: list[dict[str, Any]] = []

    msg = out.get("message")
    if isinstance(msg, str):
        new_msg, found = _scrub_text(msg, rules)
        out["message"] = new_msg
        findings.extend(found)

    attrs = out.get("attributes")
    if isinstance(attrs, dict):
        out["attributes"] = _scrub_dict(attrs, rules, findings)
    return out, findings


def _scrub_dict(
    d: dict[str, Any],
    rules: list[dict[str, Any]],
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in d.items():
        if isinstance(v, str):
            new_v, found = _scrub_text(v, rules)
            out[k] = new_v
            findings.extend(found)
        elif isinstance(v, dict):
            out[k] = _scrub_dict(v, rules, findings)
        else:
            out[k] = v
    return out
