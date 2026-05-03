"use client";

import { useMemo } from "react";

type LineSeries = {
  id: string;
  color: string;
  values: number[];
};

type ApmLineChartProps = {
  series: LineSeries[];
  height?: number;
  yTicks?: number;
  formatY?: (v: number) => string;
};

const TIME_LABELS = ["14:00", "14:15", "14:30", "14:45"];

export function ApmLineChart({
  series,
  height = 200,
  yTicks = 4,
  formatY = (v) => Math.round(v).toString(),
}: ApmLineChartProps) {
  const max = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const m = Math.max(0, ...all);
    return niceCeil(m === 0 ? 1 : m);
  }, [series]);

  const ticks = useMemo(
    () => Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i),
    [max, yTicks],
  );

  const length = series[0]?.values.length ?? 0;
  const w = 100;
  const h = 100;

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
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {series.map((s) => {
            const points = s.values
              .map(
                (v, i) =>
                  `${(i / Math.max(1, length - 1)) * w},${
                    h - (v / max) * h
                  }`,
              )
              .join(" ");
            return (
              <polyline
                key={s.id}
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
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
