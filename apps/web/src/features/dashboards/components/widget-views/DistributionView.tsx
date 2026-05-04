"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import {
  defaultDistributionConfig,
  widgetQueryToMetricQuery,
  type AggregateOverTime,
  type DistributionConfig,
  type Widget,
} from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

type Bin = {
  bucket: string;
  bucketStart: number;
  count: number;
};

export function DistributionView({ widget, timeRange }: Props) {
  const cfg = widget.config?.distribution ?? defaultDistributionConfig();
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

  return <Histogram series={series} cfg={cfg} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function Histogram({
  series,
  cfg,
}: {
  series: Series[];
  cfg: DistributionConfig;
}) {
  const samples = useMemo<number[]>(() => {
    if (cfg.histogramOf === "groups") {
      return series.map((s) => aggregateSeries(s, cfg.aggregateOverTime));
    }
    return series.flatMap((s) => s.points.map((p) => p.value));
  }, [series, cfg]);

  const bins = useMemo<Bin[]>(() => {
    if (samples.length === 0) return [];
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    if (max === min) {
      return [{ bucket: min.toFixed(2), bucketStart: min, count: samples.length }];
    }
    const width = (max - min) / cfg.numBuckets;
    const counts = new Array<number>(cfg.numBuckets).fill(0);
    for (const v of samples) {
      const idx = Math.min(
        cfg.numBuckets - 1,
        Math.max(0, Math.floor((v - min) / width)),
      );
      counts[idx] += 1;
    }
    return counts.map((count, i) => {
      const start = min + i * width;
      const end = start + width;
      return {
        bucket: `${formatNum(start)}–${formatNum(end)}`,
        bucketStart: start,
        count,
      };
    });
  }, [samples, cfg.numBuckets]);

  if (bins.length === 0) return <Empty>No data.</Empty>;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bins}
            margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="#eef0f2" vertical={false} />
            <XAxis
              dataKey="bucket"
              stroke="#9aa0a6"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#eef0f2" }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#9aa0a6"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={40}
              scale={cfg.yAxisScale === "log" ? "log" : "auto"}
              domain={cfg.yAxisScale === "log" ? [1, "auto"] : [0, "auto"]}
              allowDataOverflow
            />
            <Tooltip
              cursor={{ fill: "#f1f3f4" }}
              wrapperStyle={{ outline: "none" }}
              formatter={(value: number) => [`${value} ${labelFor(cfg)}`]}
              labelFormatter={(label: string) => `Range: ${label}`}
            />
            <Bar
              dataKey="count"
              fill="#7c3aed"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {cfg.showLegend && (
        <div className="mt-1 px-2 text-[10px] text-[#5f6368]">
          {samples.length} {labelFor(cfg)} across {bins.length} buckets
        </div>
      )}
    </div>
  );
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

function labelFor(cfg: DistributionConfig): string {
  return cfg.histogramOf === "groups" ? "groups" : "points";
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(2);
}
