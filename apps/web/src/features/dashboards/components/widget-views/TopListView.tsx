"use client";

import { useMemo } from "react";
import { PALETTE_COLORS } from "@/features/metrics/constants";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import {
  defaultTopListConfig,
  widgetQueryToMetricQuery,
  type AggregateOverTime,
  type TopListConfig,
  type Widget,
} from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

type Row = {
  label: string;
  value: number;
  share: number;
  rank: number;
};

export function TopListView({ widget, timeRange }: Props) {
  const cfg = widget.config?.top_list ?? defaultTopListConfig();
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

  return <List series={series} cfg={cfg} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function List({ series, cfg }: { series: Series[]; cfg: TopListConfig }) {
  const rows = useMemo<Row[]>(() => {
    const all = series.map((s) => ({
      label: prettyLabel(s),
      value: aggregateSeries(s, cfg.aggregateOverTime),
    }));
    const total = all.reduce((acc, r) => acc + Math.abs(r.value), 0) || 1;
    const sorted = [...all].sort((a, b) =>
      cfg.sortDir === "asc" ? a.value - b.value : b.value - a.value,
    );
    return sorted.slice(0, cfg.limit).map((r, i) => ({
      ...r,
      share: Math.abs(r.value) / total,
      rank: i + 1,
    }));
  }, [series, cfg]);

  if (rows.length === 0) return <Empty>No data.</Empty>;

  const max = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;
  const palette = PALETTE_COLORS["classic"];

  return (
    <div className="h-full overflow-auto px-2 py-2">
      <ol className="flex flex-col gap-1.5">
        {rows.map((r, i) => {
          const widthPct =
            cfg.scaling === "relative"
              ? r.share * 100
              : (Math.abs(r.value) / max) * 100;
          const color = palette[i % palette.length];
          return (
            <li key={`${r.label}-${i}`} className="text-[12px] text-[#202124]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right tabular-nums text-[#9aa0a6]">
                    {r.rank}
                  </span>
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="tabular-nums text-[#5f6368]">
                  {cfg.scaling === "relative"
                    ? `${(r.share * 100).toFixed(1)}%`
                    : r.value.toFixed(2)}
                </span>
              </div>
              <div
                className={`mt-1 h-2 overflow-hidden ${
                  cfg.display === "flat" ? "rounded-sm" : "rounded-full"
                } bg-[#f1f3f4]`}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, widthPct))}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function prettyLabel(s: Series): string {
  const tags = Object.entries(s.groupTags);
  if (tags.length === 0) return s.label;
  return tags.map(([k, v]) => `${k}:${v}`).join(", ");
}

function aggregateSeries(s: Series, agg: AggregateOverTime): number {
  const pts = s.points;
  if (pts.length === 0) return 0;
  switch (agg) {
    case "sum":
      return pts.reduce((a, p) => a + p.value, 0);
    case "min":
      return Math.min(...pts.map((p) => p.value));
    case "max":
      return Math.max(...pts.map((p) => p.value));
    case "last":
      return pts[pts.length - 1].value;
    case "avg":
    default:
      return pts.reduce((a, p) => a + p.value, 0) / pts.length;
  }
}
