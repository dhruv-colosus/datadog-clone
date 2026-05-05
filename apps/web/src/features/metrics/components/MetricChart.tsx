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
import { PALETTE_COLORS } from "../constants";
import { useMetricSeries } from "../hooks";
import { useExplorerStore } from "../store";
import type {
  MetricQuery,
  Series,
  TimeRange,
  VisualizationType,
} from "../types";

type Props = {
  query: MetricQuery;
};

const STROKE_WIDTH: Record<string, number> = {
  thin: 1,
  normal: 2,
  thick: 3,
};

const STROKE_DASH: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "2 4",
};

export function MetricChart({ query }: Props) {
  const timeRange = useExplorerStore((s) => s.timeRange);
  const visualization = useExplorerStore((s) => s.visualization);
  const colorPalette = useExplorerStore((s) => s.colorPalette);
  const lineStyle = useExplorerStore((s) => s.lineStyle);
  const lineStroke = useExplorerStore((s) => s.lineStroke);
  const reverseOrder = useExplorerStore((s) => s.reverseOrder);

  const { data: series, isLoading } = useMetricSeries(query, timeRange);

  const palette = PALETTE_COLORS[colorPalette];
  const orderedSeries = useMemo(() => {
    if (!series) return [];
    return reverseOrder ? [...series].reverse() : series;
  }, [series, reverseOrder]);

  const label = query.displayName ?? defaultLabel(query);

  if (!query.metricName) {
    return (
      <ChartShell label={label}>
        <EmptyMessage text="Pick a metric to start." />
      </ChartShell>
    );
  }

  if (isLoading || !series) {
    return (
      <ChartShell label={label}>
        <EmptyMessage text="Loading…" />
      </ChartShell>
    );
  }

  return (
    <ChartShell label={label}>
      {visualization === "heatmap" ? (
        <HeatmapView series={orderedSeries} palette={palette} />
      ) : visualization === "toplist" ? (
        <TopListView series={orderedSeries} palette={palette} />
      ) : visualization === "query_value" ? (
        <QueryValueView series={orderedSeries} color={palette[0]} />
      ) : (
        <TimeSeriesView
          series={orderedSeries}
          timeRange={timeRange}
          visualization={visualization}
          palette={palette}
          lineStyle={lineStyle}
          lineStroke={lineStroke}
        />
      )}
    </ChartShell>
  );
}

function ChartShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[420px] flex-col rounded-md bg-white">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-[13px] text-[#202124]">{label}</span>
        <div className="flex items-center gap-3 text-[#5f6368]">
          <button
            type="button"
            className="text-[13px] hover:text-[#202124]"
            title="Export"
          >
            ⇪
          </button>
        </div>
      </div>
      <div className="flex-1 px-1 pb-1">{children}</div>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {text}
    </div>
  );
}

function defaultLabel(query: MetricQuery) {
  if (!query.metricName) return query.alias;
  return query.metricName;
}

type TooltipPayload = {
  dataKey: string;
  value: number;
  color: string;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0];
  return (
    <div className="pointer-events-none flex flex-col items-start gap-1">
      <span
        className="rounded-md px-2 py-0.5 text-[12px] text-white shadow-sm"
        style={{ backgroundColor: point.color }}
      >
        {point.dataKey}
      </span>
      <span className="rounded-md bg-[#202124] px-2 py-1 text-[12px] font-semibold text-white shadow-sm">
        {point.value.toFixed(1)} <span className="font-normal">%</span>
      </span>
    </div>
  );
}

function ChartLegend({
  series,
  colors,
}: {
  series: Series[];
  colors: string[];
}) {
  return (
    <ul className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-3 text-[12px] text-[#202124]">
      {series.map((s, i) => (
        <li key={`${s.label}-${i}`} className="inline-flex items-center gap-1.5">
          <span
            className="block h-3 w-3 rounded-[2px]"
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
    return `${d.getMonth() + 1}/${d.getDate()} ${d
      .getHours()
      .toString()
      .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function TimeSeriesView({
  series,
  timeRange,
  visualization,
  palette,
  lineStyle,
  lineStroke,
}: {
  series: Series[];
  timeRange: TimeRange;
  visualization: VisualizationType;
  palette: string[];
  lineStyle: "solid" | "dashed" | "dotted";
  lineStroke: "thin" | "normal" | "thick";
}) {
  const data = useMemo(() => buildChartData(series), [series]);
  const labels = series.map((s) => s.label);
  const strokeWidth = STROKE_WIDTH[lineStroke];
  const strokeDasharray = STROKE_DASH[lineStyle];

  if (data.length === 0) {
    return <EmptyMessage text="No data." />;
  }

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
        width={48}
        label={{
          value: "Percent",
          angle: -90,
          position: "insideLeft",
          offset: 12,
          style: { fill: "#9aa0a6", fontSize: 11 },
        }}
      />
      <Tooltip
        cursor={{ stroke: "#bdc1c6", strokeDasharray: "3 3" }}
        content={<ChartTooltip />}
        offset={16}
        wrapperStyle={{ outline: "none" }}
      />
    </>
  );

  const dotProps = {
    r: 4,
    fill: "#202124",
    stroke: "#ffffff",
    strokeWidth: 2,
  };

  let chart: React.ReactElement;
  if (visualization === "bar") {
    chart = (
      <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
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
    );
  } else if (visualization === "area") {
    chart = (
      <AreaChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
        {axes}
        {labels.map((label, i) => (
          <Area
            key={label}
            dataKey={label}
            stroke={palette[i % palette.length]}
            fill={palette[i % palette.length]}
            fillOpacity={0.25}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            activeDot={dotProps}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    );
  } else {
    chart = (
      <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
        {axes}
        {labels.map((label, i) => (
          <Line
            key={label}
            dataKey={label}
            stroke={palette[i % palette.length]}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            dot={false}
            activeDot={dotProps}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      <ChartLegend series={series} colors={palette} />
    </div>
  );
}

function seriesAverage(s: Series): number {
  if (s.points.length === 0) return 0;
  let sum = 0;
  for (const p of s.points) sum += p.value;
  return sum / s.points.length;
}

function seriesLast(s: Series): number {
  return s.points.length === 0 ? 0 : s.points[s.points.length - 1].value;
}

function HeatmapView({
  series,
  palette,
}: {
  series: Series[];
  palette: string[];
}) {
  if (series.length === 0) return <EmptyMessage text="No data." />;

  const baseColor = palette[0] ?? "#3b82f6";
  let max = -Infinity;
  let min = Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.value > max) max = p.value;
      if (p.value < min) min = p.value;
    }
  }
  if (!Number.isFinite(max) || !Number.isFinite(min) || max === min) {
    max = (min === Infinity ? 0 : min) + 1;
    min = min === Infinity ? 0 : min;
  }

  return (
    <div className="flex h-full flex-col gap-1 overflow-auto px-2 py-2">
      {series.map((s, rowIdx) => (
        <div
          key={`${s.label}-${rowIdx}`}
          className="flex items-center gap-2 text-[12px] text-[#202124]"
        >
          <span className="w-40 shrink-0 truncate" title={s.label}>
            {s.label}
          </span>
          <div className="flex h-5 flex-1 gap-px">
            {s.points.map((p, i) => {
              const t = (p.value - min) / (max - min);
              return (
                <span
                  key={i}
                  className="block h-full flex-1"
                  style={{
                    backgroundColor: baseColor,
                    opacity: 0.15 + 0.85 * t,
                  }}
                  title={`${p.value.toFixed(2)}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopListView({
  series,
  palette,
}: {
  series: Series[];
  palette: string[];
}) {
  if (series.length === 0) return <EmptyMessage text="No data." />;
  const ranked = series
    .map((s, idx) => ({ s, value: seriesAverage(s), idx }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...ranked.map((r) => r.value), 0) || 1;
  return (
    <ul className="flex h-full flex-col gap-1.5 overflow-auto px-3 py-3 text-[13px]">
      {ranked.map(({ s, value, idx }) => {
        const color = palette[idx % palette.length];
        const pct = Math.max(2, (value / max) * 100);
        return (
          <li key={`${s.label}-${idx}`} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[#202124]">
              <span className="truncate" title={s.label}>
                {s.label}
              </span>
              <span className="ml-2 font-mono text-[12px] text-[#5f6368]">
                {value.toFixed(2)}
              </span>
            </div>
            <div className="h-2 w-full rounded-sm bg-[#f1f3f4]">
              <div
                className="h-full rounded-sm"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QueryValueView({
  series,
  color,
}: {
  series: Series[];
  color: string;
}) {
  if (series.length === 0) return <EmptyMessage text="No data." />;
  const lastValues = series.map(seriesLast);
  const value =
    lastValues.reduce((a, b) => a + b, 0) / Math.max(1, lastValues.length);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <span
        className="font-semibold tabular-nums"
        style={{ color, fontSize: "min(96px, 18vw)", lineHeight: 1 }}
      >
        {value.toFixed(2)}
      </span>
      <span className="text-[12px] text-[#5f6368]">
        avg of {series.length} series · last value
      </span>
    </div>
  );
}

