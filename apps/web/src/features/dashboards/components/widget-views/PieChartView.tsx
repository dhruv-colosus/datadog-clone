"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PALETTE_COLORS } from "@/features/metrics/constants";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import { widgetQueryToMetricQuery, type Widget } from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

export function PieChartView({ widget, timeRange }: Props) {
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

  return <Chart series={series} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function Chart({ series }: { series: Series[] }) {
  const palette = PALETTE_COLORS["classic"];
  const data = useMemo(() => {
    return series.map((s) => {
      const last = s.points[s.points.length - 1]?.value ?? 0;
      return { name: s.label, value: Math.max(0, last) };
    });
  }, [series]);
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (total === 0) return <Empty>No data.</Empty>;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="50%"
              outerRadius="85%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${value.toFixed(1)} (${total > 0 ? ((value / total) * 100).toFixed(1) : "0"}%)`,
              ]}
              wrapperStyle={{ outline: "none" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[11px] text-[#202124]">
        {data.map((d, i) => (
          <li key={`${d.name}-${i}`} className="inline-flex items-center gap-1.5">
            <span
              className="block h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: palette[i % palette.length] }}
            />
            <span>{d.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
