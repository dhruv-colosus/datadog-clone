"""LTTB downsampling — caps a series at N points while preserving visual shape."""

from __future__ import annotations

from typing import Sequence


def lttb(points: Sequence[tuple[float, float]], threshold: int) -> list[tuple[float, float]]:
    """Largest-Triangle-Three-Buckets downsample.

    `points` is an ordered sequence of (t, value). Returns a list of <= threshold
    (t, value) pairs that visually approximates the original line chart.
    """
    n = len(points)
    if threshold >= n or threshold <= 2:
        return list(points)

    sampled: list[tuple[float, float]] = [points[0]]
    bucket_size = (n - 2) / (threshold - 2)

    a = 0
    for i in range(threshold - 2):
        avg_t = 0.0
        avg_v = 0.0
        avg_start = int((i + 1) * bucket_size) + 1
        avg_end = int((i + 2) * bucket_size) + 1
        avg_end = min(avg_end, n)
        avg_count = max(1, avg_end - avg_start)
        for j in range(avg_start, avg_end):
            avg_t += points[j][0]
            avg_v += points[j][1]
        avg_t /= avg_count
        avg_v /= avg_count

        range_start = int(i * bucket_size) + 1
        range_end = int((i + 1) * bucket_size) + 1
        range_end = min(range_end, n)

        max_area = -1.0
        chosen = range_start
        ax, ay = points[a]
        for j in range(range_start, range_end):
            bx, by = points[j]
            area = abs((ax - avg_t) * (by - ay) - (ax - bx) * (avg_v - ay)) * 0.5
            if area > max_area:
                max_area = area
                chosen = j
        sampled.append(points[chosen])
        a = chosen
    sampled.append(points[-1])
    return sampled
