"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import { useMemo } from "react";
import { fetchMetricSeries } from "@/features/metrics/api";
import { metricKeys } from "@/features/metrics/hooks";
import type { Series, TimeRange } from "@/features/metrics/types";
import {
  defaultChangeConfig,
  widgetQueryToMetricQuery,
  type ChangeConfig,
  type Widget,
} from "../../types";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

type Row = {
  label: string;
  past: number;
  present: number;
  change: number;
  percent: number;
};

const SHIFT_MS: Record<ChangeConfig["compareTo"], number> = {
  hour_before: 60 * 60 * 1000,
  day_before: 24 * 60 * 60 * 1000,
  week_before: 7 * 24 * 60 * 60 * 1000,
  month_before: 30 * 24 * 60 * 60 * 1000,
};

export function ChangeView({ widget, timeRange }: Props) {
  const cfg = widget.config?.change ?? defaultChangeConfig();

  const pastRange: TimeRange = useMemo(
    () => ({
      preset: "custom" as const,
      fromMs: timeRange.fromMs - SHIFT_MS[cfg.compareTo],
      toMs: timeRange.toMs - SHIFT_MS[cfg.compareTo],
    }),
    [timeRange.fromMs, timeRange.toMs, cfg.compareTo],
  );

  const presentResults = useQueries({
    queries: widget.queries.map((q) => {
      const mq = widgetQueryToMetricQuery(q);
      return {
        queryKey: metricKeys.series(mq, timeRange),
        queryFn: () => fetchMetricSeries(mq, timeRange),
        enabled: Boolean(mq.metricName),
        staleTime: 30_000,
      };
    }),
  });
  const pastResults = useQueries({
    queries: widget.queries.map((q) => {
      const mq = widgetQueryToMetricQuery(q);
      return {
        queryKey: metricKeys.series(mq, pastRange),
        queryFn: () => fetchMetricSeries(mq, pastRange),
        enabled: Boolean(mq.metricName),
        staleTime: 30_000,
      };
    }),
  });

  const hasMetric = widget.queries.some((q) => q.metricName);
  const isLoading =
    presentResults.some((r) => r.isLoading) ||
    pastResults.some((r) => r.isLoading);
  const presentSeries = useMemo(
    () => presentResults.flatMap((r) => r.data ?? []),
    [presentResults],
  );
  const pastSeries = useMemo(
    () => pastResults.flatMap((r) => r.data ?? []),
    [pastResults],
  );

  if (!hasMetric) return <Empty>Pick a metric to start.</Empty>;
  if (isLoading && presentSeries.length === 0) return <Empty>Loading…</Empty>;
  if (presentSeries.length === 0) return <Empty>No data.</Empty>;

  return <Table presentSeries={presentSeries} pastSeries={pastSeries} cfg={cfg} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
      {children}
    </div>
  );
}

function Table({
  presentSeries,
  pastSeries,
  cfg,
}: {
  presentSeries: Series[];
  pastSeries: Series[];
  cfg: ChangeConfig;
}) {
  const rows = useMemo<Row[]>(() => {
    const pastByLabel = new Map<string, number>();
    pastSeries.forEach((s) => {
      pastByLabel.set(prettyLabel(s), avg(s));
    });
    const out = presentSeries.map<Row>((s) => {
      const label = prettyLabel(s);
      const present = avg(s);
      const past = pastByLabel.get(label) ?? 0;
      const delta = present - past;
      const percent = past === 0 ? 0 : (delta / Math.abs(past)) * 100;
      return { label, present, past, change: delta, percent };
    });
    const cmp = (a: Row, b: Row): number => {
      switch (cfg.orderBy) {
        case "name":
          return a.label.localeCompare(b.label);
        case "present":
          return a.present - b.present;
        case "past":
          return a.past - b.past;
        case "change":
        default:
          return (
            (cfg.changeType === "relative" ? a.percent : a.change) -
            (cfg.changeType === "relative" ? b.percent : b.change)
          );
      }
    };
    return out.sort((a, b) => (cfg.orderDir === "asc" ? cmp(a, b) : -cmp(a, b)));
  }, [presentSeries, pastSeries, cfg]);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-[#dadce0] text-left text-[11px] uppercase tracking-wide text-[#5f6368]">
            <th className="px-3 py-1.5 font-medium">Series</th>
            <th className="px-3 py-1.5 text-right font-medium">Past</th>
            {cfg.showPresent && (
              <th className="px-3 py-1.5 text-right font-medium">Present</th>
            )}
            <th className="px-3 py-1.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <ChangeRow key={`${row.label}-${i}`} row={row} cfg={cfg} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeRow({ row, cfg }: { row: Row; cfg: ChangeConfig }) {
  const value = cfg.changeType === "relative" ? row.percent : row.change;
  const goingUp = value > 0;
  const isFlat = Math.abs(value) < 1e-6;
  const good = goingUp === cfg.increaseGood;
  const color = isFlat ? "#5f6368" : good ? "#188038" : "#d93025";
  const Icon = isFlat ? Minus : goingUp ? ArrowUp : ArrowDown;

  return (
    <tr className="border-b border-[#f1f3f4] text-[#202124] hover:bg-[#f8f9fa]">
      <td className="px-3 py-1.5">{row.label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-[#5f6368]">
        {row.past.toFixed(2)}
      </td>
      {cfg.showPresent && (
        <td className="px-3 py-1.5 text-right tabular-nums">
          {row.present.toFixed(2)}
        </td>
      )}
      <td
        className="px-3 py-1.5 text-right tabular-nums"
        style={{ color }}
      >
        <span className="inline-flex items-center gap-1">
          <Icon size={11} weight="bold" />
          {cfg.changeType === "relative"
            ? `${value.toFixed(1)}%`
            : value.toFixed(2)}
        </span>
      </td>
    </tr>
  );
}

function prettyLabel(s: Series): string {
  const tags = Object.entries(s.groupTags);
  if (tags.length === 0) return s.label;
  return tags.map(([k, v]) => `${k}:${v}`).join(", ");
}

function avg(s: Series): number {
  if (s.points.length === 0) return 0;
  return s.points.reduce((a, p) => a + p.value, 0) / s.points.length;
}
