"""Deterministic seeded randomness for the telemetry generators.

Stable across restarts: a tick at time T produces identical telemetry on every
run. This is critical for the backfill — the same 7-day history appears on every
fresh boot.
"""

from __future__ import annotations

import hashlib
import math
import random
from typing import Iterable


def _seed_from_parts(parts: Iterable[object]) -> int:
    """Hash a heterogeneous tuple of parts into a stable 64-bit seed."""
    raw = "::".join(str(p) for p in parts).encode("utf-8")
    digest = hashlib.blake2b(raw, digest_size=8).digest()
    return int.from_bytes(digest, "big")


def seeded_rng(*parts: object) -> random.Random:
    """Build a fresh `random.Random` instance from arbitrary hashable parts.

    Examples:
        rng = seeded_rng("system.cpu.user", host_id, tick_index)
        rng = seeded_rng("trace", "api", trace_id)
    """
    return random.Random(_seed_from_parts(parts))


def daily_sine(t_seconds: float, period_seconds: float = 86_400.0) -> float:
    """Returns a sine wave in [-1, 1] following wall-clock-of-day.

    `t_seconds` is the Unix time in seconds. Phase aligned so the trough sits
    around 04:00 UTC and peak around 16:00 UTC, matching realistic load curves.
    """
    phase_offset = 4 * 3600  # shift trough to 04:00 UTC
    return math.sin(2 * math.pi * ((t_seconds - phase_offset) / period_seconds))


def lognormal_ms(rng: random.Random, mean_ms: float, sigma: float) -> float:
    """Sample a lognormal latency with the given mean (in ms) and sigma.

    `mean_ms` is the *median* in ms. Caller picks sigma to control tail length:
    sigma=0.4 is tight, sigma=0.9 is heavy-tailed.
    """
    mu = math.log(max(mean_ms, 0.1))
    return rng.lognormvariate(mu, sigma)
