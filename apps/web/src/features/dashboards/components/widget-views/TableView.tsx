"use client";

import { useMemo } from "react";
import { useMultipleMetricSeries } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import { widgetQueryToMetricQuery, type Widget } from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

type Row = {
  alias: string;
  label: string;
  groupTags: Record<string, string>;
  last: number;
  avg: number;
  min: number;
  max: number;
};

export function TableView({ widget, timeRange }: Props) {
  const results = useMultipleMetricSeries(
    widget.queries.map(widgetQueryToMetricQuery),
    timeRange,
  );

  const hasMetric = widget.queries.some((q) => q.metricName);
  const isLoading = results.some((r) => r.isLoading);
  const allSeries = useMemo<Series[]>(
    () => results.flatMap((r) => r.data ?? []),
    [results],
  );

  const groupBy = useMemo(() => {
    const set = new Set<string>();
    widget.queries.forEach((q) => q.groupBy.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [widget.queries]);

  const showAliasColumn = widget.queries.length > 1;

  if (!hasMetric) return <Empty>Pick a metric to start.</Empty>;
  if (isLoading && allSeries.length === 0) return <Empty>Loading…</Empty>;
  if (allSeries.length === 0) return <Empty>No data.</Empty>;

  return (
    <Table
      series={allSeries}
      groupBy={groupBy}
      showAliasColumn={showAliasColumn}
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

function Table({
  series,
  groupBy,
  showAliasColumn,
}: {
  series: Series[];
  groupBy: string[];
  showAliasColumn: boolean;
}) {
  const rows = useMemo<Row[]>(() => {
    return series
      .map((s) => {
        const points = s.points;
        const last = points[points.length - 1]?.value ?? 0;
        const sum = points.reduce((acc, p) => acc + p.value, 0);
        const avg = points.length > 0 ? sum / points.length : 0;
        const min = points.reduce(
          (acc, p) => (p.value < acc ? p.value : acc),
          points[0]?.value ?? 0,
        );
        const max = points.reduce(
          (acc, p) => (p.value > acc ? p.value : acc),
          points[0]?.value ?? 0,
        );
        return {
          alias: s.alias,
          label: s.label,
          groupTags: s.groupTags,
          last,
          avg,
          min,
          max,
        };
      })
      .sort((a, b) => b.last - a.last);
  }, [series]);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-[#dadce0] text-left text-[11px] uppercase tracking-wide text-[#5f6368]">
            {showAliasColumn && (
              <th className="px-3 py-1.5 font-medium">Query</th>
            )}
            {groupBy.length > 0 ? (
              groupBy.map((g) => (
                <th key={g} className="px-3 py-1.5 font-medium">
                  {g}
                </th>
              ))
            ) : (
              <th className="px-3 py-1.5 font-medium">Series</th>
            )}
            <th className="px-3 py-1.5 text-right font-medium">last</th>
            <th className="px-3 py-1.5 text-right font-medium">avg</th>
            <th className="px-3 py-1.5 text-right font-medium">min</th>
            <th className="px-3 py-1.5 text-right font-medium">max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.alias}-${row.label}-${i}`}
              className="border-b border-[#f1f3f4] text-[#202124] hover:bg-[#f8f9fa]"
            >
              {showAliasColumn && (
                <td className="px-3 py-1.5 font-medium uppercase text-[#7c3aed]">
                  {row.alias}
                </td>
              )}
              {groupBy.length > 0 ? (
                groupBy.map((g) => (
                  <td key={g} className="px-3 py-1.5">
                    {row.groupTags[g] ?? "—"}
                  </td>
                ))
              ) : (
                <td className="px-3 py-1.5">{row.label}</td>
              )}
              <td className="px-3 py-1.5 text-right tabular-nums">
                {row.last.toFixed(2)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-[#5f6368]">
                {row.avg.toFixed(2)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-[#5f6368]">
                {row.min.toFixed(2)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-[#5f6368]">
                {row.max.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
