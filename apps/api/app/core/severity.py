"""Canonical severity scale shared across incidents, security signals, watchdog stories, and CI alerts."""

from __future__ import annotations

from typing import Literal

SeverityLevel = Literal["critical", "high", "medium", "low", "info"]
IncidentSeverity = Literal["SEV-1", "SEV-2", "SEV-3", "SEV-4", "SEV-5"]

SEVERITY_LEVELS: tuple[SeverityLevel, ...] = (
    "critical",
    "high",
    "medium",
    "low",
    "info",
)

INCIDENT_SEVERITIES: tuple[IncidentSeverity, ...] = (
    "SEV-1",
    "SEV-2",
    "SEV-3",
    "SEV-4",
    "SEV-5",
)

SEVERITY_RANK: dict[SeverityLevel, int] = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
    "info": 0,
}

INCIDENT_TO_LEVEL: dict[IncidentSeverity, SeverityLevel] = {
    "SEV-1": "critical",
    "SEV-2": "high",
    "SEV-3": "medium",
    "SEV-4": "low",
    "SEV-5": "info",
}

LEVEL_TO_INCIDENT: dict[SeverityLevel, IncidentSeverity] = {
    v: k for k, v in INCIDENT_TO_LEVEL.items()
}


def level_for_incident(sev: IncidentSeverity) -> SeverityLevel:
    return INCIDENT_TO_LEVEL[sev]


def incident_for_level(level: SeverityLevel) -> IncidentSeverity:
    return LEVEL_TO_INCIDENT[level]


def severity_rank(level: SeverityLevel) -> int:
    return SEVERITY_RANK[level]
