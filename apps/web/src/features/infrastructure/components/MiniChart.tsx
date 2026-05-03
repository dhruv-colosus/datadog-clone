"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { buildPanelTimeSeries } from "../mock-data";

type Props = {
  seed: string;
  base: number;
  amp: number;
  stroke?: string;
  fill?: string;
  type?: "line" | "area";
  yMin?: number;
  yMax?: number;
  height?: number;
  showYTicks?: boolean;
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function MiniChart({
  seed,
  base,
  amp,
  stroke = "#4285f4",
  fill,
  type = "line",
  yMin,
  yMax,
  height = 120,
  showYTicks = true,
}: Props) {
  const data = useMemo(
    () => buildPanelTimeSeries(hashSeed(seed), 60, base, amp),
    [seed, base, amp],
  );

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "area" ? (
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <YAxis
              tick={showYTicks ? { fontSize: 10, fill: "#9aa0a6" } : false}
              tickLine={false}
              axisLine={false}
              width={showYTicks ? 28 : 0}
              domain={yMin !== undefined && yMax !== undefined ? [yMin, yMax] : ["auto", "auto"]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={stroke}
              fill={fill ?? stroke}
              fillOpacity={0.25}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <YAxis
              tick={showYTicks ? { fontSize: 10, fill: "#9aa0a6" } : false}
              tickLine={false}
              axisLine={false}
              width={showYTicks ? 28 : 0}
              domain={yMin !== undefined && yMax !== undefined ? [yMin, yMax] : ["auto", "auto"]}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
