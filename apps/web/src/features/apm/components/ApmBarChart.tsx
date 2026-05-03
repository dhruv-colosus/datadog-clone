"use client";

import { useMemo } from "react";

type Series = {
  id: string;
  color: string;
  values: number[];
};

type ApmBarChartProps = {
  series: Series[];
  yLabel?: string;
  height?: number;
  yTicks?: number;
  formatY?: (v: number) => string;
};

const TIME_LABELS = ["14:00", "14:15", "14:30", "14:45"];

export function ApmBarChart({
  series,
  yLabel,
  height = 200,
  yTicks = 4,
  formatY = (v) => Math.round(v).toString(),
}: ApmBarChartProps) {
  const max = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const m = Math.max(0, ...all);
    return m === 0 ? 1 : m;
  }, [series]);

  const niceMax = useMemo(() => niceCeil(max), [max]);

  const ticks = useMemo(() => {
    return Array.from({ length: yTicks + 1 }, (_, i) => (niceMax / yTicks) * i);
  }, [niceMax, yTicks]);

  const length = series[0]?.values.length ?? 0;

  return (
    <div className="flex w-full" style={{ height }}>
      <div className="flex flex-col-reverse justify-between pr-2 text-[10px] text-[#5f6368]">
        {ticks.map((t, i) => (
          <span key={i} className="leading-none">
            {formatY(t)}
          </span>
        ))}
      </div>

      <div className="relative flex-1">
        <div className="absolute inset-0 flex flex-col-reverse justify-between">
          {ticks.map((_, i) => (
            <div
              key={i}
              className="border-t border-dashed border-[#e8eaed]"
              style={{ height: 0 }}
            />
          ))}
        </div>
        <div className="relative flex h-full items-end gap-[2px]">
          {Array.from({ length }, (_, i) => (
            <div
              key={i}
              className="relative flex flex-1 flex-col-reverse items-stretch gap-[1px]"
            >
              {series.map((s) => {
                const v = s.values[i] ?? 0;
                const pct = (v / niceMax) * 100;
                if (pct < 0.5) return null;
                return (
                  <div
                    key={s.id}
                    className="rounded-sm"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: s.color,
                      opacity: 0.85,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {yLabel && (
          <span className="pointer-events-none absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-wide text-[#5f6368]">
            {yLabel}
          </span>
        )}
        <div className="mt-1 flex justify-between text-[10px] text-[#5f6368]">
          {TIME_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const mantissa = v / exp;
  let nice = 1;
  if (mantissa <= 1) nice = 1;
  else if (mantissa <= 2) nice = 2;
  else if (mantissa <= 5) nice = 5;
  else nice = 10;
  return nice * exp;
}
