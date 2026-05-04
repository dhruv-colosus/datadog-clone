"use client";

import { useMemo } from "react";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import {
  defaultQueryValueConfig,
  widgetQueryToMetricQuery,
  type AggregateOverTime,
  type ConditionalFormat,
  type QueryValueConfig,
  type Widget,
} from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

export function QueryValueView({ widget, timeRange }: Props) {
  const cfg = widget.config?.query_value ?? defaultQueryValueConfig();
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

  const value = aggregateScalar(series, cfg.aggregateOverTime);
  return <ValueDisplay value={value} cfg={cfg} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function ValueDisplay({
  value,
  cfg,
}: {
  value: number;
  cfg: QueryValueConfig;
}) {
  const matched = matchConditionalFormat(value, cfg.conditionalFormats);
  const { bg, fg } = colorsFor(matched);

  const display = formatValue(value, cfg);

  const align =
    cfg.textAlign === "left"
      ? "items-start text-left pl-6"
      : cfg.textAlign === "right"
        ? "items-end text-right pr-6"
        : "items-center text-center";

  return (
    <div
      className={`flex h-full w-full flex-col justify-center ${align}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      <div
        className="font-semibold leading-none tabular-nums"
        style={{ fontSize: "clamp(28px, 8vw, 96px)" }}
      >
        {display.value}
        {display.suffix && (
          <span
            className="ml-1 align-baseline font-medium opacity-80"
            style={{ fontSize: "0.45em" }}
          >
            {display.suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function aggregateScalar(series: Series[], agg: AggregateOverTime): number {
  // Reduce all series → all points → single scalar.
  const points = series.flatMap((s) => s.points.map((p) => p.value));
  if (points.length === 0) return 0;
  switch (agg) {
    case "sum":
      return points.reduce((a, b) => a + b, 0);
    case "min":
      return Math.min(...points);
    case "max":
      return Math.max(...points);
    case "last":
      return series[series.length - 1]?.points.at(-1)?.value ?? 0;
    case "avg":
    default:
      return points.reduce((a, b) => a + b, 0) / points.length;
  }
}

function matchConditionalFormat(
  value: number,
  formats: ConditionalFormat[],
): ConditionalFormat | null {
  for (const f of formats) {
    if (
      (f.comparator === ">" && value > f.value) ||
      (f.comparator === ">=" && value >= f.value) ||
      (f.comparator === "<" && value < f.value) ||
      (f.comparator === "<=" && value <= f.value)
    ) {
      return f;
    }
  }
  return null;
}

function colorsFor(f: ConditionalFormat | null): { bg: string; fg: string } {
  if (!f) return { bg: "transparent", fg: "#202124" };
  switch (f.palette) {
    case "white_on_green":
      return { bg: "#34a853", fg: "#ffffff" };
    case "white_on_yellow":
      return { bg: "#f9ab00", fg: "#ffffff" };
    case "white_on_red":
      return { bg: "#d93025", fg: "#ffffff" };
    case "green_on_white":
      return { bg: "transparent", fg: "#34a853" };
    case "yellow_on_white":
      return { bg: "transparent", fg: "#f9ab00" };
    case "red_on_white":
      return { bg: "transparent", fg: "#d93025" };
    default:
      return { bg: "transparent", fg: "#202124" };
  }
}

function formatValue(
  value: number,
  cfg: QueryValueConfig,
): { value: string; suffix: string } {
  if (cfg.autoscale) {
    const { scaled, suffix } = autoscale(value);
    const unit = cfg.customUnit ? ` ${cfg.customUnit}` : "";
    return {
      value: scaled.toFixed(cfg.precision),
      suffix: `${suffix}${unit}`.trim(),
    };
  }
  return {
    value: value.toFixed(cfg.precision),
    suffix: cfg.customUnit ?? "",
  };
}

function autoscale(value: number): { scaled: number; suffix: string } {
  const abs = Math.abs(value);
  if (abs >= 1e12) return { scaled: value / 1e12, suffix: "T" };
  if (abs >= 1e9) return { scaled: value / 1e9, suffix: "G" };
  if (abs >= 1e6) return { scaled: value / 1e6, suffix: "M" };
  if (abs >= 1e3) return { scaled: value / 1e3, suffix: "K" };
  return { scaled: value, suffix: "" };
}
