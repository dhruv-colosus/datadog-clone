"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useMemo } from "react";
import type { ApmFlameSpan } from "../types";
import { colorForService } from "./TraceFlameGraph";

type LegendEntry = {
  key: string;
  durationMs: number;
  pct: number;
};

export function TraceLegend({
  spans,
  totalDurationMs,
}: {
  spans: ApmFlameSpan[];
  totalDurationMs: number;
}) {
  const entries = useMemo<LegendEntry[]>(() => {
    if (!spans.length) return [];
    const byService = new Map<string, number>();
    for (const s of spans) {
      // Prefer host for HTTP egress spans so external endpoints surface in the
      // legend (matches Datadog's behavior for `requests` / outbound calls).
      const key = s.host ?? s.service;
      byService.set(key, (byService.get(key) ?? 0) + s.durationMs);
    }
    // Use sum of span durations as the denominator (not trace duration) so the
    // percentages always add to ~100% even when spans run in parallel.
    const sum = Array.from(byService.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(byService.entries())
      .map(([key, durationMs]) => ({
        key,
        durationMs,
        pct: (durationMs / sum) * 100,
      }))
      .sort((a, b) => b.durationMs - a.durationMs);
  }, [spans, totalDurationMs]);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l border-[#e8eaed] bg-white">
      <div className="flex items-center justify-between border-b border-[#e8eaed] px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#5f6368]">
        <span className="inline-flex items-center gap-1">
          % Exec Time
          <CaretDown size={9} weight="bold" />
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {entries.map((e) => {
          // Use the span's true service for color; fall back to the legend key
          // when host doesn't map to a known palette entry.
          const matchedSpan = spans.find((s) => (s.host ?? s.service) === e.key);
          const color = colorForService(matchedSpan?.service ?? e.key);
          return (
            <div key={e.key} className="mb-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 0 2px ${color}33`,
                    }}
                  />
                  <span className="truncate text-[#202124]" title={e.key}>
                    {e.key}
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-[#5f6368]">
                  {e.pct >= 99.5 ? "100" : e.pct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[#f1f3f4]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, e.pct)}%`,
                    backgroundColor: "#4285f4",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
