"use client";

type Point = { ts: number; p50?: number; p75?: number; p95?: number; count?: number };

export function PerfChart({
  current,
  previous,
  width = 1100,
  height = 220,
  unit = "ms",
  thresholds,
  color = "#1a73e8",
}: {
  current: Point[];
  previous?: Point[];
  width?: number;
  height?: number;
  unit?: string;
  thresholds?: { good: number; needsImprovement: number };
  color?: string;
}) {
  const all = [...current, ...(previous ?? [])];
  if (all.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-[#dadce0] text-[13px] text-[#9aa0a6]"
        style={{ width, height }}
      >
        No data available
      </div>
    );
  }

  const valueOf = (p: Point) => p.p75 ?? p.p50 ?? p.count ?? 0;
  const tsMin = current.length ? current[0].ts : all[0].ts;
  const tsMax = current.length ? current[current.length - 1].ts : all[all.length - 1].ts;

  const ceiling = Math.max(
    1,
    ...all.map(valueOf),
    thresholds ? thresholds.needsImprovement * 1.2 : 0,
  );
  const padTop = 24;
  const padBottom = 28;
  const padLeft = 44;
  const padRight = 16;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const dx = (ts: number) =>
    padLeft + ((ts - tsMin) / Math.max(1, tsMax - tsMin)) * innerW;
  const dy = (v: number) => padTop + innerH - (v / ceiling) * innerH;

  const linePath = (pts: Point[], yKey: (p: Point) => number) =>
    pts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${dx(p.ts).toFixed(1)} ${dy(yKey(p)).toFixed(1)}`,
      )
      .join(" ");

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) =>
    Math.round((ceiling * i) / ticks),
  );

  const xTickCount = Math.min(6, current.length);
  const xTicks =
    current.length > 1
      ? Array.from({ length: xTickCount }, (_, i) =>
          Math.round((tsMin + (i * (tsMax - tsMin)) / Math.max(1, xTickCount - 1))),
        )
      : current.map((p) => p.ts);

  return (
    <svg width={width} height={height} className="block">
      {thresholds && (
        <>
          <rect
            x={padLeft}
            y={padTop}
            width={innerW}
            height={dy(thresholds.needsImprovement) - padTop}
            fill="rgba(244, 67, 54, 0.05)"
          />
          <rect
            x={padLeft}
            y={dy(thresholds.needsImprovement)}
            width={innerW}
            height={dy(thresholds.good) - dy(thresholds.needsImprovement)}
            fill="rgba(255, 193, 7, 0.06)"
          />
          <rect
            x={padLeft}
            y={dy(thresholds.good)}
            width={innerW}
            height={padTop + innerH - dy(thresholds.good)}
            fill="rgba(76, 175, 80, 0.05)"
          />
        </>
      )}

      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={dy(tick)}
            y2={dy(tick)}
            stroke="#eef0f3"
          />
          <text
            x={padLeft - 6}
            y={dy(tick) + 3}
            fontSize={10}
            fill="#9aa0a6"
            textAnchor="end"
          >
            {fmtTick(tick, unit)}
          </text>
        </g>
      ))}

      {xTicks.map((t, i) => (
        <text
          key={t + ":" + i}
          x={dx(t)}
          y={height - 8}
          fontSize={10}
          fill="#9aa0a6"
          textAnchor="middle"
        >
          {fmtX(t, tsMax - tsMin)}
        </text>
      ))}

      {previous && previous.length > 0 && (
        <path
          d={linePath(previous, valueOf)}
          fill="none"
          stroke="#bdc1c6"
          strokeDasharray="3 3"
          strokeWidth={1.2}
        />
      )}
      {current.length > 0 && (
        <path d={linePath(current, valueOf)} fill="none" stroke={color} strokeWidth={1.6} />
      )}
    </svg>
  );
}

function fmtTick(value: number, unit: string): string {
  if (unit === "ms") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
    return `${value}ms`;
  }
  if (unit === "%") return `${value}%`;
  return String(value);
}

function fmtX(ts: number, span: number): string {
  const date = new Date(ts);
  if (span <= 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
