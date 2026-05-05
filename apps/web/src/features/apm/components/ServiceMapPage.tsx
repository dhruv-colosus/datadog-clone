"use client";

import {
  Faders,
  MagnifyingGlass,
  Question,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TimeRangePicker } from "@/components/ui/TimeRangePicker";
import { useApmServiceMap } from "../hooks";
import { useApmHomeStore, useApmTracesStore } from "../store";
import type {
  ApmServiceMapEdge,
  ApmServiceMapNode,
} from "../types";
import { ApmHeader } from "./ApmHeader";

const NODE_W = 168;
const NODE_H = 80;
const COL_GAP = 220;
const ROW_GAP = 30;

const SERVICE_FILL: Record<string, string> = {
  caddy: "#10b981",
  web: "#a8c5f7",
  api: "#a142f4",
  auth: "#34a853",
  payments: "#fbbc04",
  worker: "#f59e0b",
  postgres: "#1a73e8",
  redis: "#e8b3a8",
};

const HEALTH_BORDER: Record<string, string> = {
  critical: "#d32f2f",
  warning: "#fdd835",
  ok: "#dadce0",
};

const PULSE_PURPLE = "#1a73e8";
const PULSE_RED = "#d93025";

// Topology tier — entry points on the left, leaves on the right.
const TIER_BY_SERVICE: Record<string, number> = {
  caddy: 0,
  web: 1,
  api: 2,
  auth: 3,
  payments: 3,
  worker: 4,
  postgres: 5,
  redis: 5,
};

type Layout = {
  nodes: Map<string, { x: number; y: number; node: ApmServiceMapNode }>;
  width: number;
  height: number;
};

function layoutNodes(nodes: ApmServiceMapNode[]): Layout {
  // Stable column-based layout: tier → x, sorted index within tier → y.
  const byTier = new Map<number, ApmServiceMapNode[]>();
  for (const n of nodes) {
    const tier = TIER_BY_SERVICE[n.service] ?? 3;
    const list = byTier.get(tier) ?? [];
    list.push(n);
    byTier.set(tier, list);
  }
  for (const [, list] of byTier) {
    list.sort((a, b) => a.service.localeCompare(b.service));
  }

  const tiers = Array.from(byTier.keys()).sort((a, b) => a - b);
  const maxRows = Math.max(
    ...Array.from(byTier.values()).map((l) => l.length),
    1,
  );
  const positioned = new Map<
    string,
    { x: number; y: number; node: ApmServiceMapNode }
  >();
  tiers.forEach((tier, ti) => {
    const list = byTier.get(tier) ?? [];
    list.forEach((n, ri) => {
      const colHeight = list.length * (NODE_H + ROW_GAP) - ROW_GAP;
      const offset = (maxRows * (NODE_H + ROW_GAP) - colHeight) / 2;
      positioned.set(n.service, {
        x: 60 + ti * COL_GAP,
        y: 60 + offset + ri * (NODE_H + ROW_GAP),
        node: n,
      });
    });
  });

  const width = 60 + tiers.length * COL_GAP;
  const height = 60 + maxRows * (NODE_H + ROW_GAP);
  return { nodes: positioned, width, height };
}

function pathFor(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function strokeForEdge(edge: ApmServiceMapEdge): string {
  if (edge.errors > 0 && edge.calls > 0 && edge.errors / edge.calls > 0.05) {
    return "#d93025";
  }
  if (edge.calls === 0) return "#dadce0";
  return "#a8c5f7";
}

function pulseColorForEdge(edge: ApmServiceMapEdge): string {
  const errRate = edge.errorRate ?? (edge.calls > 0 ? edge.errors / edge.calls : 0);
  return errRate > 0.05 ? PULSE_RED : PULSE_PURPLE;
}

function pulseDurationForEdge(edge: ApmServiceMapEdge): number {
  const rate = edge.callRate ?? 0;
  if (rate <= 0) return 0;
  // High traffic = fast pulses (down to 0.5s); low traffic = slow (up to 4s).
  const seconds = Math.max(0.5, Math.min(4, 4 - Math.log10(1 + rate * 10)));
  return seconds;
}

function widthForEdge(edge: ApmServiceMapEdge, max: number): number {
  if (edge.calls === 0) return 1.2;
  const ratio = max > 0 ? edge.calls / max : 0;
  return 1.2 + ratio * 4;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

export function ServiceMapPage() {
  const router = useRouter();
  const env = useApmHomeStore((s) => s.envFilter);
  const setEnv = useApmHomeStore((s) => s.setEnvFilter);
  const range = useApmTracesStore((s) => s.timeRange);
  const setRange = useApmTracesStore((s) => s.setTimeRange);
  const lookback = Math.max(60, Math.min(86400, Math.round((range.toMs - range.fromMs) / 1000)));
  const { data, isLoading } = useApmServiceMap(env, lookback);
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (!data) return null;
    return layoutNodes(data.nodes);
  }, [data]);

  const maxCalls = useMemo(
    () => Math.max(1, ...(data?.edges.map((e) => e.calls) ?? [])),
    [data],
  );

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <ApmHeader>
        <TimeRangePicker value={range} onChange={setRange} />
        <button
          type="button"
          aria-label="Help"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <Question size={14} weight="bold" />
        </button>
      </ApmHeader>

      <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
          <MagnifyingGlass size={13} className="text-[#5f6368]" />
          <input
            type="text"
            placeholder="Search service map"
            className="w-[260px] bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
          />
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <Faders size={12} />
          Filters
        </button>
        <div className="ml-auto flex items-center gap-2">
          <EnvSelect value={env} onChange={setEnv} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="px-6 py-10 text-[13px] text-[#5f6368]">
            Loading service map…
          </div>
        )}
        {layout && (
          <svg
            width={layout.width + 20}
            height={layout.height + 20}
            className="block"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="9"
                markerHeight="9"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L0,8 L8,4 z" fill="#5f6368" />
              </marker>
              <marker
                id="arrowhead-error"
                markerWidth="9"
                markerHeight="9"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L0,8 L8,4 z" fill="#d93025" />
              </marker>
              <marker
                id="arrowhead-mute"
                markerWidth="9"
                markerHeight="9"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L0,8 L8,4 z" fill="#dadce0" />
              </marker>
            </defs>

            {/* edges */}
            {data?.edges.map((edge) => {
              const a = layout.nodes.get(edge.caller);
              const b = layout.nodes.get(edge.callee);
              if (!a || !b) return null;
              const stroke = strokeForEdge(edge);
              const marker =
                stroke === "#d93025"
                  ? "arrowhead-error"
                  : stroke === "#dadce0"
                  ? "arrowhead-mute"
                  : "arrowhead";
              const muted =
                hovered && hovered !== edge.caller && hovered !== edge.callee;
              const pathId = `edge-${edge.caller}-${edge.callee}`;
              const pulseDur = pulseDurationForEdge(edge);
              const pulseColor = pulseColorForEdge(edge);
              return (
                <g
                  key={`${edge.caller}-${edge.callee}`}
                  opacity={muted ? 0.2 : 1}
                >
                  <path
                    id={pathId}
                    d={pathFor(a, b)}
                    stroke={stroke}
                    strokeWidth={widthForEdge(edge, maxCalls)}
                    fill="none"
                    markerEnd={`url(#${marker})`}
                  />
                  {pulseDur > 0 && !muted && (
                    <>
                      <circle r="2.4" fill={pulseColor} opacity="0.95">
                        <animateMotion
                          dur={`${pulseDur}s`}
                          repeatCount="indefinite"
                        >
                          <mpath href={`#${pathId}`} />
                        </animateMotion>
                      </circle>
                      <circle r="4.8" fill={pulseColor} opacity="0.25">
                        <animateMotion
                          dur={`${pulseDur}s`}
                          repeatCount="indefinite"
                        >
                          <mpath href={`#${pathId}`} />
                        </animateMotion>
                      </circle>
                    </>
                  )}
                  {edge.calls > 0 && (
                    <text
                      x={(a.x + NODE_W + b.x) / 2}
                      y={(a.y + b.y) / 2 + NODE_H / 2 - 6}
                      fill="#5f6368"
                      fontSize="10.5"
                      textAnchor="middle"
                    >
                      {edge.calls.toLocaleString()}
                    </text>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {Array.from(layout.nodes.values()).map(({ x, y, node }) => {
              const fill = SERVICE_FILL[node.service] ?? "#5f6368";
              const muted = hovered && hovered !== node.service;
              const border =
                HEALTH_BORDER[node.healthState ?? "ok"] ?? fill;
              const bg = node.inferred ? "#e8f0fe" : "white";
              return (
                <g
                  key={node.service}
                  transform={`translate(${x},${y})`}
                  onMouseEnter={() => setHovered(node.service)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => router.push(`/apm/services/${node.service}`)}
                  opacity={muted ? 0.4 : 1}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={bg}
                    stroke={border}
                    strokeWidth={node.healthState === "ok" ? 1.5 : 2.5}
                  />
                  <circle cx={16} cy={20} r={5} fill={fill} />
                  <text
                    x={28}
                    y={24}
                    fill="#202124"
                    fontSize="13"
                    fontWeight="600"
                  >
                    {node.service}
                  </text>
                  <text
                    x={NODE_W - 10}
                    y={24}
                    fill="#5f6368"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="end"
                  >
                    {node.type.toUpperCase()}
                  </text>
                  <text x={14} y={48} fill="#5f6368" fontSize="11">
                    {node.rps.toFixed(2)} req/s
                  </text>
                  <text x={14} y={64} fill="#5f6368" fontSize="11">
                    p95 {formatLatency(node.p95LatencyMs)}
                  </text>
                  <text
                    x={NODE_W - 10}
                    y={64}
                    fill={node.errorRate > 0.05 ? "#d93025" : "#5f6368"}
                    fontSize="11"
                    textAnchor="end"
                  >
                    {(node.errorRate * 100).toFixed(1)}% err
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-[#e8eaed] bg-white px-4 py-2 text-[11.5px] text-[#5f6368]">
        <LegendChip color="#a8c5f7" label="Healthy edge" />
        <LegendChip color="#d93025" label="Errors > 5%" />
        <LegendChip color="#dadce0" label="No traffic in window" />
        <LegendChip color="#1a73e8" label="Traffic pulse" />
        <LegendChip color="#fdd835" label="Warning" />
        <LegendChip color="#d32f2f" label="Critical" />
        <span className="ml-auto">
          {data?.nodes.length ?? 0} services · {data?.edges.length ?? 0} edges
        </span>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function EnvSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
    >
      <option value="prod">env:prod</option>
      <option value="staging">env:staging</option>
      <option value="dev">env:dev</option>
    </select>
  );
}
