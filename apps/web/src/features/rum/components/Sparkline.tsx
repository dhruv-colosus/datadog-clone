"use client";

type Point = { ts: number; value: number };

export function Sparkline({
  points,
  width = 280,
  height = 96,
  thresholds,
  color = "#1a73e8",
}: {
  points: Point[];
  width?: number;
  height?: number;
  thresholds?: { good: number; needsImprovement: number };
  color?: string;
}) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-[#9aa0a6]"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const ceiling = thresholds
    ? Math.max(thresholds.needsImprovement * 1.1, ...ys, 1)
    : Math.max(...ys, 1) * 1.15;

  const dx = (t: number) =>
    ((t - minX) / Math.max(1, maxX - minX)) * (width - 8) + 4;
  const dy = (v: number) => height - 8 - (v / ceiling) * (height - 16);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${dx(p.ts).toFixed(1)} ${dy(p.value).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="block">
      {thresholds && (
        <>
          <rect
            x={0}
            y={0}
            width={width}
            height={dy(thresholds.needsImprovement)}
            fill="rgba(244, 67, 54, 0.06)"
          />
          <rect
            x={0}
            y={dy(thresholds.needsImprovement)}
            width={width}
            height={dy(thresholds.good) - dy(thresholds.needsImprovement)}
            fill="rgba(255, 193, 7, 0.08)"
          />
          <rect
            x={0}
            y={dy(thresholds.good)}
            width={width}
            height={height - dy(thresholds.good)}
            fill="rgba(76, 175, 80, 0.06)"
          />
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
