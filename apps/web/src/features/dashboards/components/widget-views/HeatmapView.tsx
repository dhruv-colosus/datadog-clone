"use client";

import { useMemo } from "react";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import {
  defaultHeatmapConfig,
  widgetQueryToMetricQuery,
  type HeatmapConfig,
  type Widget,
} from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

export function HeatmapView({ widget, timeRange }: Props) {
  const cfg = widget.config?.heatmap ?? defaultHeatmapConfig();
  const results = useMultipleMetricSeries(
    widget.queries.map(widgetQueryToMetricQuery),
    timeRange,
  );

  const hasMetric = widget.queries.some((q) => q.metricName);
  const isLoading = results.some((r) => r.isLoading);
  const series = useMemo(
    () => results.flatMap((r) => r.data ?? []),
    [results],
  );

  if (!hasMetric) return <Empty>Pick a metric to start.</Empty>;
  if (isLoading && series.length === 0) return <Empty>Loading…</Empty>;
  if (series.length === 0) return <Empty>No data.</Empty>;

  return <Heatmap series={series} timeRange={timeRange} cfg={cfg} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function Heatmap({
  series,
  timeRange,
  cfg,
}: {
  series: Series[];
  timeRange: TimeRange;
  cfg: HeatmapConfig;
}) {
  // Re-bucket points across uniform time buckets so the matrix is rectangular.
  const buckets = cfg.numBuckets;
  const span = timeRange.toMs - timeRange.fromMs;
  const bucketSize = span / buckets;

  const rows = useMemo(() => {
    return series.map((s) => {
      const cells = new Array<number | null>(buckets).fill(null);
      const counts = new Array<number>(buckets).fill(0);
      for (const p of s.points) {
        if (p.t < timeRange.fromMs || p.t > timeRange.toMs) continue;
        const idx = Math.min(
          buckets - 1,
          Math.max(0, Math.floor((p.t - timeRange.fromMs) / bucketSize)),
        );
        cells[idx] = (cells[idx] ?? 0) + p.value;
        counts[idx] += 1;
      }
      const avg = cells.map((c, i) => (counts[i] ? (c as number) / counts[i] : null));
      return { label: prettyLabel(s), cells: avg };
    });
  }, [series, buckets, bucketSize, timeRange.fromMs, timeRange.toMs]);

  const flat = rows
    .flatMap((r) => r.cells)
    .filter((v): v is number => v !== null);
  let minV = cfg.yAxisMin ?? (flat.length ? Math.min(...flat) : 0);
  let maxV = cfg.yAxisMax ?? (flat.length ? Math.max(...flat) : 1);
  if (cfg.yAxisIncludeZero) {
    minV = Math.min(minV, 0);
    maxV = Math.max(maxV, 0);
  }
  if (maxV === minV) maxV = minV + 1;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex h-full w-full flex-col gap-[2px] px-2 py-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex min-h-[14px] flex-1 items-center gap-2"
            >
              <span
                className="w-32 shrink-0 truncate text-right text-[10px] text-[#5f6368]"
                title={row.label}
              >
                {row.label}
              </span>
              <div className="flex h-full flex-1 gap-[1px]">
                {row.cells.map((v, i) => (
                  <div
                    key={i}
                    className="h-full flex-1"
                    style={{
                      backgroundColor:
                        v === null
                          ? "#f1f3f4"
                          : colorFor(scaleValue(v, minV, maxV, cfg.yAxisScale)),
                    }}
                    title={
                      v === null
                        ? "no data"
                        : `${row.label} — ${v.toFixed(2)} @ ${formatTime(
                            timeRange.fromMs + i * bucketSize,
                            timeRange,
                          )}`
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 px-2 pb-1 text-[10px] text-[#5f6368]">
        <span>{minV.toFixed(2)}</span>
        <div
          className="h-2 flex-1 rounded-sm"
          style={{
            background:
              "linear-gradient(to right, #eef2ff, #a5b4fc, #6366f1, #4338ca, #1e1b4b)",
          }}
        />
        <span>{maxV.toFixed(2)}</span>
      </div>
    </div>
  );
}

function prettyLabel(s: Series): string {
  const tags = Object.entries(s.groupTags);
  if (tags.length === 0) return s.label;
  return tags.map(([k, v]) => `${k}:${v}`).join(", ");
}

function scaleValue(
  v: number,
  min: number,
  max: number,
  scale: HeatmapConfig["yAxisScale"],
): number {
  // Returns 0..1
  const denom = max - min;
  if (denom <= 0) return 0;
  const norm = (v - min) / denom;
  switch (scale) {
    case "log": {
      const positive = Math.max(1e-9, norm);
      return Math.log10(1 + 9 * positive);
    }
    case "pow":
      return Math.pow(norm, 2);
    case "sqrt":
      return Math.sqrt(Math.max(0, norm));
    case "linear":
    default:
      return Math.min(1, Math.max(0, norm));
  }
}

function colorFor(t: number): string {
  // Indigo ramp — eef2ff → 1e1b4b
  const stops = [
    { t: 0, c: [238, 242, 255] },
    { t: 0.25, c: [165, 180, 252] },
    { t: 0.5, c: [99, 102, 241] },
    { t: 0.75, c: [67, 56, 202] },
    { t: 1, c: [30, 27, 75] },
  ];
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (clamped <= b.t) {
      const local = (clamped - a.t) / (b.t - a.t);
      const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * local);
      const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * local);
      const bb = Math.round(a.c[2] + (b.c[2] - a.c[2]) * local);
      return `rgb(${r}, ${g}, ${bb})`;
    }
  }
  return "rgb(30, 27, 75)";
}

function formatTime(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  const span = range.toMs - range.fromMs;
  const oneDay = 24 * 60 * 60 * 1000;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (span > oneDay) {
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
