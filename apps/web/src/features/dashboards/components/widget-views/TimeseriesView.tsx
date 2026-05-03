"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PALETTE_COLORS } from "@/features/metrics/constants";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import {
  widgetQueryToMetricQuery,
  type TimeseriesDisplay,
  type Widget,
} from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

export function TimeseriesView({ widget, timeRange }: Props) {
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

  if (!hasMetric) {
    return <Empty>Pick a metric to start.</Empty>;
  }
  if (isLoading && series.length === 0) {
    return <Empty>Loading…</Empty>;
  }
  if (series.length === 0) {
    return <Empty>No data.</Empty>;
  }

  return (
    <Chart
      series={series}
      timeRange={timeRange}
      display={widget.display ?? "lines"}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function Chart({
  series,
  timeRange,
  display,
}: {
  series: Series[];
  timeRange: TimeRange;
  display: TimeseriesDisplay;
}) {
  const data = useMemo(() => buildChartData(series), [series]);
  const labels = series.map((s) => s.label);
  const palette = PALETTE_COLORS["classic"];

  const axes = (
    <>
      <CartesianGrid stroke="#eef0f2" vertical={false} />
      <XAxis
        dataKey="t"
        type="number"
        domain={[timeRange.fromMs, timeRange.toMs]}
        tickFormatter={(ts) => formatTime(ts as number, timeRange)}
        stroke="#9aa0a6"
        fontSize={11}
        tickLine={false}
        axisLine={{ stroke: "#eef0f2" }}
      />
      <YAxis
        stroke="#9aa0a6"
        fontSize={11}
        tickLine={false}
        axisLine={false}
        width={40}
      />
      <Tooltip
        cursor={{ stroke: "#bdc1c6", strokeDasharray: "3 3" }}
        wrapperStyle={{ outline: "none" }}
      />
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {display === "bars" ? (
            <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              {axes}
              {labels.map((label, i) => (
                <Bar
                  key={label}
                  dataKey={label}
                  fill={palette[i % palette.length]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : display === "areas" ? (
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              {axes}
              {labels.map((label, i) => (
                <Area
                  key={label}
                  dataKey={label}
                  stroke={palette[i % palette.length]}
                  fill={palette[i % palette.length]}
                  fillOpacity={0.25}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              {axes}
              {labels.map((label, i) => (
                <Line
                  key={label}
                  dataKey={label}
                  stroke={palette[i % palette.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <Legend series={series} colors={palette} />
    </div>
  );
}

function Legend({ series, colors }: { series: Series[]; colors: string[] }) {
  return (
    <ul className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[11px] text-[#202124]">
      {series.map((s, i) => (
        <li key={`${s.label}-${i}`} className="inline-flex items-center gap-1.5">
          <span
            className="block h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: colors[i % colors.length] }}
          />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

function buildChartData(series: Series[]) {
  const tMap = new Map<number, Record<string, number | string>>();
  series.forEach((s) => {
    s.points.forEach((p) => {
      const row = tMap.get(p.t) ?? { t: p.t };
      row[s.label] = p.value;
      tMap.set(p.t, row);
    });
  });
  return Array.from(tMap.values()).sort(
    (a, b) => (a.t as number) - (b.t as number),
  );
}

function formatTime(ts: number, range: TimeRange) {
  const d = new Date(ts);
  const span = range.toMs - range.fromMs;
  const oneDay = 24 * 60 * 60 * 1000;
  if (span > oneDay) {
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
